import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { GAME_CASES, prepareV2Case, submitArticle } from './helpers';

for (const c of GAME_CASES) {
  test(`${c.id}: 図解を公開し、内容と根拠を読める`, async ({ page }, testInfo) => {
    await prepareV2Case(page, c);
    await submitArticle(page);
    const guide = c.debrief.visualGuide!;
    const panel = page.getByRole('region', { name: '資料に沿った解説', exact: true });
    await expect(panel).toHaveCount(0);
    await page.getByRole('button', { name: '資料に沿った解説を開く', exact: true }).click();
    await expect(panel.getByRole('heading', { name: guide.title, exact: true })).toBeVisible();
    const image = panel.getByRole('img', { name: guide.imageAlt, exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1536);
    await expect(panel.getByRole('link', { name: /図を大きく見る/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    await expect(panel.getByText(guide.limit, { exact: true })).toBeVisible();
    await expect(panel.getByTestId('case-disclaimer')).toBeVisible();
    await expect(panel.locator('.debrief-scope')).toBeVisible();
    const facts = panel
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: '図の内容と根拠を読む' }) });
    await expect(facts).not.toHaveAttribute('open', '');
    await facts.locator('summary').click();
    if (guide.panels) {
      for (const item of guide.panels)
        await expect(facts.getByText(item.body, { exact: true })).toBeVisible();
    } else {
      await expect(facts.getByText('45人 ÷ 50人', { exact: true })).toBeVisible();
    }
    await facts.locator('summary').click();
    const answers = panel
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: '問いごとの解説と根拠を読む' }) });
    await answers.locator('summary').click();
    await expect(
      answers.getByRole('heading', { name: c.v2!.decoding[0]!.prompt, exact: true }),
    ).toBeVisible();
    await answers.locator('summary').click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    mkdirSync('qa/screenshots/visual-explanations', { recursive: true });
    await panel.screenshot({
      path: `qa/screenshots/visual-explanations/${c.id}-${testInfo.project.name}.png`,
    });
  });
}
