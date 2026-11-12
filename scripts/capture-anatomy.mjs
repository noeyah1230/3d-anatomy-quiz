import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { records, sides } from '../src/features/anatomy/review/catalog.ts';
import {
  mappingFingerprint,
  sha256,
} from '../src/features/anatomy/review/validation.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'docs/screenshots/anatomy');
const capturePath = resolve(output, 'captures.json');
const refresh = process.argv.includes('--refresh');
const prior = JSON.parse(
  await readFile(capturePath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '{}';
    throw error;
  }),
);

const captures = {};
const pending = [];
for (const record of records.filter(
  ({ mapping }) => mapping.status === 'mapped',
)) {
  const fingerprint = mappingFingerprint(record);
  const entry = prior[record.id];
  const path = resolve(output, `${record.id}.jpg`);
  const existing =
    !refresh && entry?.mappingFingerprint === fingerprint
      ? await readFile(path).catch((error) => {
          if (error.code === 'ENOENT') return undefined;
          throw error;
        })
      : undefined;
  if (
    existing &&
    entry.sha256 === sha256(existing) &&
    JSON.stringify(entry.sides) === JSON.stringify(sides)
  ) {
    captures[record.id] = entry;
  } else {
    pending.push({ record, fingerprint, path });
  }
}

if (!pending.length) {
  console.log(
    `All ${Object.keys(captures).length} review images match their mapping and checksum.`,
  );
  process.exit(0);
}

const port = Number(process.env.ANATOMY_CAPTURE_PORT ?? 4175);
const url = `http://127.0.0.1:${port}/`;
const server = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    cwd: root,
    stdio: 'inherit',
  },
);
let browser;
try {
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (server.exitCode !== null)
      throw new Error('The Vite server could not start.');
    if (
      await fetch(url).then(
        (response) => response.ok,
        () => false,
      )
    )
      break;
    if (Date.now() >= deadline)
      throw new Error('Timed out waiting for the review server.');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    ...(process.env.ANATOMY_USE_CHROME === '1' ? { channel: 'chrome' } : {}),
    args: ['--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 720 },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(90_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${url}?review=1&target=${pending[0].record.id}`, {
    waitUntil: 'commit',
  });
  const chooser = page.getByLabel('Anatomy target');
  await chooser.waitFor();
  await page.addStyleTag({ content: '.inspector { visibility: hidden; }' });
  const stage = page.locator('.stage');
  const rendered = [];

  for (const { record, fingerprint, path } of pending) {
    await chooser.selectOption(record.id);
    await page
      .getByRole('button', { name: 'Reset review view' })
      .and(page.locator(':enabled'))
      .waitFor();
    const images = [];
    for (const side of sides) {
      await page.getByLabel('Side', { exact: true }).selectOption(side);
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (let frame = 0; frame < 3; frame++)
          await new Promise(requestAnimationFrame);
      });
      images.push((await stage.screenshot()).toString('base64'));
    }
    const composite = await page.evaluate(
      async ({ images, sides }) => {
        const frames = await Promise.all(
          images.map(async (image) => {
            const frame = new Image();
            frame.src = `data:image/png;base64,${image}`;
            await frame.decode();
            return frame;
          }),
        );
        const scale = 0.75;
        const width = Math.round(frames[0].width * scale);
        const height = Math.round(frames[0].height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width * 2 + 2;
        canvas.height = height + 27;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Browser has no 2D image context.');
        context.fillStyle = '#111219';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const redPixels = [];
        frames.forEach((frame, index) => {
          const x = index * (width + 2);
          context.drawImage(frame, x, 0, width, height);
          const pixels = context.getImageData(x, 0, width, height).data;
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (
              pixels[i] > 90 &&
              pixels[i] > pixels[i + 1] * 1.35 &&
              pixels[i] > pixels[i + 2] * 1.35
            )
              count++;
          }
          redPixels.push(count);
          context.font = '12px system-ui';
          context.fillStyle = '#f5f5f6';
          context.fillText(
            sides[index] === 'left' ? 'Anatomical left' : 'Anatomical right',
            x + 10,
            height + 17,
          );
        });
        return {
          image: canvas.toDataURL('image/jpeg', 0.9).split(',')[1],
          redPixels,
        };
      },
      { images, sides },
    );

    if (composite.redPixels.some((count) => count < 60)) {
      throw new Error(
        `${record.id}: insufficient red pixels in one or both views (${composite.redPixels.join(', ')}).`,
      );
    }
    if (errors.length) throw new Error(errors.join('\n'));
    const bytes = Buffer.from(composite.image, 'base64');
    captures[record.id] = {
      mappingFingerprint: fingerprint,
      sha256: sha256(bytes),
      sides,
    };
    rendered.push({ path, bytes });
    if (rendered.length % 7 === 0 || rendered.length === pending.length) {
      console.log(
        `Captured ${rendered.length}/${pending.length} targets on both sides.`,
      );
    }
  }

  await mkdir(output, { recursive: true });
  for (const { path, bytes } of rendered) {
    await writeFile(`${path}.tmp`, bytes);
    await rename(`${path}.tmp`, path);
  }
  const ordered = Object.fromEntries(
    records
      .filter(({ id }) => captures[id])
      .map(({ id }) => [id, captures[id]]),
  );
  await writeFile(
    `${capturePath}.tmp`,
    JSON.stringify(ordered, null, 2) + '\n',
  );
  await rename(`${capturePath}.tmp`, capturePath);
} finally {
  await browser?.close();
  server.kill();
}
