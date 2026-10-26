import { expect, test } from '@playwright/test';
import { CASE01, CASE02_TITLE, clearCase01 } from './helpers';

test('CASE 01を計算入力なしで完了し、次の事件へ進む', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^事件一覧/ }).click();
  await page.getByRole('button', { name: new RegExp(`^CASE 01 ${CASE01.title}`) }).click();
  await expect(page).toHaveURL(/#\/play\/case-01$/);
  await clearCase01(page);
  await expect(page.getByRole('heading', { name: '根拠と判断の記録をまとめました' })).toBeVisible();
  await expect(page.getByText(/評価点：|評価ランク/)).toHaveCount(0);
  await expect(page.locator('input[inputmode="decimal"]')).toHaveCount(0);
  await page.getByRole('button', { name: '資料に沿った解説を開く' }).click();
  await expect(page.getByTestId('case-disclaimer')).toContainText('架空');
  await page.getByRole('button', { name: '次の事件へ' }).click();
  await expect(page.getByRole('heading', { level: 1, name: CASE02_TITLE })).toBeVisible();
});
