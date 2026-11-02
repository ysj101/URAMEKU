import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type Case00Data from '../data/tutorial/case-00.json';

const case00: typeof Case00Data = JSON.parse(
  readFileSync(new URL('../data/tutorial/case-00.json', import.meta.url), 'utf8'),
);

async function chooseDrinks(page: Page) {
  await expect(page.getByRole('radio', { name: /^Mサイズ/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /^Sサイズ/ }).check();
  await page.getByRole('button', { name: 'このサイズにする →' }).click();
  await expect(page.getByRole('radio', { name: /^Mサイズ/ })).toBeVisible();
  await page.getByRole('radio', { name: /^Lサイズ/ }).check();
  await page.getByRole('button', { name: '選んで資料を調べる →' }).click();
}

test('CASE00: 一覧から資料・回答・根拠・報告・解説を体験する', async ({ page }) => {
  await page.goto('/#/cases');
  await page.getByRole('button', { name: 'CASE 00 で遊び方を体験する' }).click();
  await expect(page.getByRole('heading', { name: case00.title })).toBeVisible();
  await chooseDrinks(page);
  await expect(page.getByRole('button', { name: '答えを選ぶ →' })).toBeDisabled();
  for (const doc of case00.documents) {
    await page.getByRole('button', { name: new RegExp(`${doc.title}を開く`) }).click();
    await expect(page.getByRole('article')).toContainText(doc.content.replace(/\s+/g, ' '));
  }
  await page.getByRole('button', { name: '答えを選ぶ →' }).click();
  await expect(page.getByRole('heading', { name: '4. 答えと根拠を選ぶ' })).toBeFocused();
  const answer = case00.options.find((option) => option.accepted)!;
  const evidence = case00.excerpts.find((excerpt) => excerpt.supportsAnswer)!;
  await page.getByRole('radio', { name: answer.text }).check();
  await expect(page.getByRole('button', { name: '報告をまとめる →' })).toBeDisabled();
  await page.getByRole('radio', { name: new RegExp(evidence.quote) }).check();
  await page.getByRole('button', { name: '報告をまとめる →' }).click();
  await expect(page.getByText(answer.text)).toBeVisible();
  await expect(page.getByText(case00.explanation)).toHaveCount(0);
  await page.getByRole('button', { name: '報告を提出して振り返る' }).click();
  await expect(page.getByText('CASE 00 調査完了')).toBeVisible();
  const diagram = page.getByRole('img', { name: case00.visualGuide.imageAlt });
  await expect(diagram).toBeVisible();
  expect(await diagram.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(
    true,
  );
  await expect(page.getByText(case00.explanation)).toBeHidden();
  await page.getByText('答え・根拠・詳しい解説').click();
  await expect(page.getByText(case00.explanation)).toBeVisible();
  await expect(page.getByText(case00.limit)).toBeVisible();
  await expect(page.getByRole('region', { name: 'おとり効果を学ぶ' })).toContainText(
    case00.experiment.limit,
  );
  await page.getByRole('button', { name: '← ホーム' }).click();
  await page.reload();
  await page.getByRole('button', { name: '調査をはじめる' }).click();
  await expect(page).toHaveURL(/#\/play\/case-01/);
});

test('CASE00: 狭い画面・文字200%でも各段階が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/tutorial');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const fits = async () => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  };
  await fits();
  await chooseDrinks(page);
  await fits();
  for (const doc of case00.documents) {
    await page.getByRole('button', { name: new RegExp(`${doc.title}を開く`) }).click();
    await fits();
  }
  await page.getByRole('button', { name: '答えを選ぶ →' }).click();
  await fits();
  await page.getByRole('radio', { name: case00.options[0]!.text }).check();
  await page.getByRole('radio', { name: new RegExp(case00.excerpts[0]!.quote) }).check();
  await page.getByRole('button', { name: '報告をまとめる →' }).click();
  await fits();
  await page.getByRole('button', { name: '報告を提出して振り返る' }).click();
  await fits();
});
