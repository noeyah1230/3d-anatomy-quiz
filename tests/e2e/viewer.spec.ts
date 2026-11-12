import { expect, test, type Locator, type Page } from '@playwright/test';

async function colors(page: Page, canvas: Locator) {
  const bytes = await canvas.screenshot();
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const surface = document.createElement('canvas');
    surface.width = image.width;
    surface.height = image.height;
    const context = surface.getContext('2d');
    if (!context) throw new Error('Could not read the browser screenshot.');
    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(
      0,
      0,
      image.width,
      image.height,
    );
    let red = 0;
    let blue = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const [r = 0, g = 0, b = 0] = pixels.subarray(index, index + 3);
      if (r > 90 && r > 1.35 * g && r > 1.35 * b) red++;
      if (b > 90 && b > 1.45 * r && b > 1.12 * g) blue++;
    }
    return { red, blue };
  }, bytes.toString('base64'));
}

test('renders actual meshes, changes target color, and supports orbit and zoom', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/?inspect=1');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const reset = page.getByRole('button', { name: 'Reset view' });
  await expect(reset).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Red' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(async () => (await colors(page, canvas)).red)
    .toBeGreaterThan(500);

  await page.getByRole('button', { name: 'Blue' }).click();
  await expect
    .poll(async () => (await colors(page, canvas)).blue)
    .toBeGreaterThan(500);
  expect((await colors(page, canvas)).red).toBe(0);
  const initial = await canvas.screenshot();

  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('The WebGL canvas has no bounding box.');
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 90,
    bounds.y + bounds.height / 2 + 28,
    {
      steps: 10,
    },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(initial))
    .toBe(false);
  await reset.click();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(initial))
    .toBe(true);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(initial))
    .toBe(false);

  await page.getByRole('button', { name: /Temporalis/ }).click();
  await page.getByText('Developer mesh inspector').click();
  const highlighted = page.getByRole('list', {
    name: 'Highlighted source meshes',
  });
  await expect(highlighted).toContainText('Left temporalis');
  await expect(highlighted).not.toContainText('masseter');
  await page.getByText('Developer mesh inspector').click();
  await expect
    .poll(async () => (await colors(page, canvas)).blue)
    .toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Red' }).click();
  await expect
    .poll(async () => (await colors(page, canvas)).red)
    .toBeGreaterThan(500);
  expect((await colors(page, canvas)).blue).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('offers a working retry after a failed model request', async ({
  page,
}) => {
  const pattern = '**/models/ecorche.meshopt.glb';
  await page.route(pattern, (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(
    'The anatomy model could not load',
  );
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeDisabled();
  await page.unroute(pattern);
  await page.getByRole('button', { name: 'Retry viewer' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeEnabled();
});

test('offers a usable fallback without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...options: unknown[]
    ) {
      if (type.startsWith('webgl') || type === 'experimental-webgl')
        return null;
      return Reflect.apply(getContext, this, [type, ...options]);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('WebGL 2');
  await expect(
    page.getByRole('button', { name: 'Retry viewer' }),
  ).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeDisabled();
});

test('keeps the mobile layout within the viewport in light theme', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Light theme' }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Blue' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Dark theme' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blue' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(async () => (await colors(page, canvas)).blue)
    .toBeGreaterThan(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test('reviews bilateral and deep geometry and shows unresolved targets without a substitute', async ({
  page,
}) => {
  await page.goto('/?review=1&target=masseter');
  const target = page.getByLabel('Anatomy target');
  const canvas = page.locator('canvas');
  await expect(target.locator('option')).toHaveCount(46);
  await expect(
    page.getByText('Pending human review', { exact: false }),
  ).toBeVisible();
  await expect
    .poll(async () => (await colors(page, canvas)).red)
    .toBeGreaterThan(500);

  await page.getByLabel('Side', { exact: true }).selectOption('right');
  await page
    .getByLabel('Component or mesh')
    .selectOption({ label: 'Deep part' });
  await page.getByText('Developer mesh inspector').click();
  const highlights = page.getByRole('list', {
    name: 'Highlighted source meshes',
  });
  await expect(highlights.getByRole('listitem')).toHaveCount(1);
  await expect(highlights).toContainText('Right deep part of masseter');
  await page.getByText('Developer mesh inspector').click();
  await page.getByRole('button', { name: 'Blue' }).click();
  await expect
    .poll(async () => (await colors(page, canvas)).blue)
    .toBeGreaterThan(150);

  await target.selectOption('vastus_intermedius');
  await expect(
    page.getByText('lists this target but does not show it', { exact: false }),
  ).toBeVisible();
  await expect
    .poll(async () => (await colors(page, canvas)).blue)
    .toBeGreaterThan(500);
  await target.selectOption('intercostals');
  await expect(page.getByText('Mapping blocked')).toBeVisible();
  await expect(
    page.getByText('External intercostal muscle', { exact: false }),
  ).toBeVisible();
  await expect(canvas).toHaveCount(0);
  await target.selectOption('temporalis');
  await expect(
    page.getByRole('button', { name: 'Reset review view' }),
  ).toBeEnabled();
});
