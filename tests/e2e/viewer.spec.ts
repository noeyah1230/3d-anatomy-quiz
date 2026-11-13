import { expect, test, type Locator, type Page } from '@playwright/test';
import { previewTargets } from '../../src/features/anatomy/targets';
import type { Question } from '../../src/features/quiz/questions';

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
  await expect(target.locator('option', { hasText: '(blocked)' })).toHaveCount(
    4,
  );
  await expect(
    page.getByText('42 of 46 targets have mapped geometry. 4 are blocked.'),
  ).toBeVisible();
  await expect(
    page.getByText('Pending human review', { exact: false }),
  ).toBeVisible();
  await expect
    .poll(async () => (await colors(page, canvas)).red)
    .toBeGreaterThan(500);

  const focusedView = await canvas.screenshot();
  const context = page.getByRole('checkbox', {
    name: 'Show more surrounding anatomy',
  });
  await context.check();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(focusedView))
    .toBe(false);
  await expect
    .poll(async () => (await colors(page, canvas)).red)
    .toBeGreaterThan(500);
  await context.uncheck();

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

async function practiceFixture(
  page: Page,
  {
    hash = 'cc43a8b4f218bee5da78d6c1746bd21470d1d93c6878e33b4ccdbcfc7a72b98e',
    includeQuestions = true,
  } = {},
) {
  const questions: Question[] = (includeQuestions ? previewTargets : []).map(
    (target) => ({
      target,
      name: target.label,
      kind: 'muscle',
      acceptedAnswers: [target.label],
      explanation: 'Browser test fixture.',
      hint: 'Region: Head & face.',
      region: 'Head & face',
      figureViews: ['anterior'],
      citations: [['Model reference', 'https://github.com/Charleeh/ecorche']],
      figureLabel: 'Figure 6.22',
      shownSide: 'left',
      sidePolicy: 'either',
    }),
  );

  await page.route(
    (url) => decodeURIComponent(url.pathname).includes('virtual:approved-quiz'),
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export const questions = ${JSON.stringify(questions)}; export const assetSha256 = ${JSON.stringify(hash)};`,
      }),
  );
}

test('an empty approved catalog keeps both practice modes free of questions', async ({
  page,
}) => {
  await practiceFixture(page, { includeQuestions: false });
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Scored practice', exact: true })
    .click();
  await expect(
    page.getByText('0 of 46 anatomy targets approved'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No typing questions yet' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('link', { name: 'Flashcards' }).click();
  await expect(
    page.getByRole('heading', { name: 'No flashcards yet' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal answer' })).toHaveCount(
    0,
  );
});

test('typing checks once, respects text editing and IME, and completes an approved fixture round', async ({
  page,
}) => {
  await practiceFixture(page);
  await page.goto('/?study=typing&inspect=1');
  const answer = page.getByRole('textbox', { name: 'Your answer' });
  await expect(answer).toBeEnabled();
  await expect(
    page.getByRole('heading', { name: 'Masseter', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Developer mesh inspector')).toHaveCount(0);
  await answer.fill('masseter');
  await answer.press('End');
  await answer.press('Space');
  await answer.press('ArrowLeft');
  await expect(answer).toHaveValue('masseter ');
  await answer.dispatchEvent('compositionstart', { data: 'm' });
  await answer.press('Enter');
  await expect(answer).toBeVisible();
  await answer.dispatchEvent('compositionend', { data: 'm' });
  await answer.fill('Masseter muscle!');
  await answer.press('Enter');
  await expect(page.getByRole('status')).toContainText('Correct');
  await expect(
    page.getByRole('heading', { name: 'Masseter', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Next question' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Question 2 of 2')).toBeVisible();
  await answer.fill('Masseter');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('status')).toContainText('Incorrect');
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(
    page.getByRole('heading', { name: 'Round complete' }),
  ).toBeFocused();
  await expect(page.getByText('1 of 2 correct', { exact: true })).toBeVisible();
});

test('flashcard reveal requires an explicit rating and shares the real 3D appearance controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await practiceFixture(page);
  await page.goto('/?study=flashcards');
  const canvas = page.locator('canvas');
  const reveal = page.getByRole('button', { name: 'Reveal answer' });
  const prompt = page.getByRole('heading', {
    name: 'Name the highlighted muscle',
  });
  await expect(reveal).toBeEnabled();
  await expect(prompt).toBeFocused();
  await expect
    .poll(async () => (await colors(page, canvas)).red)
    .toBeGreaterThan(500);
  await page.keyboard.press('Digit4');
  await expect(page.getByText('Question 1 of 2')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('heading', { name: 'Masseter', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Question 1 of 2')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('heading', { name: 'Masseter', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Space');
  await page.keyboard.press('Digit3');
  await expect(page.getByText('Question 2 of 2')).toBeVisible();

  await page.getByText('Appearance', { exact: true }).click();
  const displayMode = page.getByRole('combobox', { name: 'Display mode' });
  await displayMode.selectOption('Context');
  await page.getByRole('button', { name: 'Blue' }).click();
  await expect
    .poll(async () => (await colors(page, canvas)).blue)
    .toBeGreaterThan(500);
  const context = await canvas.screenshot();
  await displayMode.selectOption('Strict Quiz');
  await expect
    .poll(async () => (await canvas.screenshot()).equals(context))
    .toBe(false);
  await page.getByRole('checkbox', { name: 'Show bones' }).uncheck();
  await page.getByRole('slider', { name: 'Context opacity' }).fill('0');
  await expect
    .poll(async () => (await colors(page, canvas)).blue)
    .toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Reset appearance' }).click();
  await expect(displayMode).toHaveValue('Focus');
  await expect(
    page.getByRole('slider', { name: 'Context opacity' }),
  ).toHaveValue('50');
  await expect(
    page.getByRole('checkbox', { name: 'Show bones' }),
  ).toBeChecked();
  await expect
    .poll(async () => (await colors(page, canvas)).red)
    .toBeGreaterThan(500);

  await page.getByText('Camera', { exact: true }).click();
  const startOrbit = page.getByRole('button', { name: 'Start orbit' });
  await expect(startOrbit).toBeVisible();
  const resting = await canvas.screenshot();
  await startOrbit.click();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(resting))
    .toBe(false);
  await page.getByRole('button', { name: 'Pause orbit' }).click();
  await expect(startOrbit).toBeVisible();

  await reveal.click();
  await expect(
    page.getByRole('heading', { name: 'Temporalis', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Round complete' }),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Good' }),
  ).toHaveText('Good 1');
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Again' }),
  ).toHaveText('Again 1');
  await expect(page.getByText(/correct/)).toHaveCount(0);
});

test('a mismatched model revision leaves grading disabled', async ({
  page,
}) => {
  await practiceFixture(page, { hash: '0'.repeat(64) });
  await page.goto('/?study=typing');
  await expect(page.getByRole('alert')).toContainText(
    'The anatomy model could not load',
  );
  await expect(
    page.getByRole('textbox', { name: 'Your answer' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Check answer' }),
  ).toBeDisabled();
});

test.describe('touch practice', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('completes a flashcard round by tapping reveal and rating controls', async ({
    page,
  }) => {
    await practiceFixture(page);
    await page.goto('/?study=flashcards');
    for (const rating of ['Hard', 'Easy']) {
      await page.getByRole('button', { name: 'Reveal answer' }).tap();
      await page.getByRole('button', { name: rating }).tap();
    }
    await expect(
      page.getByRole('heading', { name: 'Round complete' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  });
});

test('the ungraded preview works without any approved questions or recall ratings', async ({
  page,
}) => {
  await practiceFixture(page, { includeQuestions: false });
  await page.goto('/?review=1');
  await page.getByRole('link', { name: 'Try ungraded preview' }).click();
  await expect(
    page.getByText('Ungraded preview.', { exact: true }),
  ).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Your answer' });
  await input.fill('A guess');
  await input.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Masseter', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('You entered A guess', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^(Correct|Incorrect)$/)).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Reveal model label' }).click();
  await page.getByRole('button', { name: 'Finish preview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Preview complete' }),
  ).toBeVisible();
  await expect(page.getByText('You explored 2 structures.')).toBeVisible();
  await expect(page.getByText(/of 2 correct/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Flashcards' }).click();
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(
    page.getByRole('group', { name: 'Rate your recall' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Next question' }).click();
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(
    page.getByRole('heading', { name: 'Temporalis', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Go to scored practice' }).click();
  await expect(
    page.getByRole('heading', { name: 'No flashcards yet' }),
  ).toBeVisible();
});
