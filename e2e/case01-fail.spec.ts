import { expect, test } from '@playwright/test';
import { fillReport, goToArticle, gotoCase01, submitArticle } from './helpers';

test('報告だけでは完了せず、根拠の解説は明示操作まで隠れる', async ({ page }) => {
  await gotoCase01(page);
  await goToArticle(page);
  await fillReport(page);
  await submitArticle(page);
  await expect(page.getByRole('heading', { name: 'まだ確認できる点があります' })).toBeVisible();
  await expect(page.getByRole('list', { name: '確認を続ける項目' })).toContainText('根拠');
  await expect(page.getByRole('heading', { name: '資料に沿った解説' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '次の事件へ' })).toHaveCount(0);
  await page.getByRole('button', { name: '資料に沿った解説を開く' }).click();
  await expect(page.getByRole('heading', { name: '資料に沿った解説' })).toBeVisible();
  await page.getByRole('button', { name: '調査・判断を見直す' }).click();
  await goToArticle(page);
  await expect(page.getByRole('textbox', { name: '確認できたこと・採る方針' })).not.toHaveValue('');
});
