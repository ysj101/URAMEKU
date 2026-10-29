import { expect, test } from '@playwright/test';
import {
  CASE01,
  docTile,
  expectBudget,
  fillReport,
  goToArticle,
  gotoCase01,
  openAndRead,
} from './helpers';
const STORAGE_KEY = 'urameku-mvp-v1';
test('V2報告と段階を復元し、端末の記録をすべて削除できる', async ({ page }) => {
  await gotoCase01(page);
  await openAndRead(page, CASE01.docs.trial);
  await openAndRead(page, CASE01.docs.retained);
  await goToArticle(page);
  await fillReport(page, '復元する調査報告');
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY))
    .toContain('復元する調査報告');
  await page.reload();
  await expect(page.getByRole('textbox', { name: '確認できたこと・採る方針' })).toHaveValue(
    '復元する調査報告',
  );
  await page.getByRole('button', { name: '← 調査へ戻る' }).click();
  await expectBudget(page, 2);
  await expect(docTile(page, CASE01.docs.trial)).toHaveAccessibleName(/調査済み/);
  await page.goto('/#/');
  await expect(page.getByRole('button', { name: '前回の続き' })).toBeVisible();
  await page.getByRole('button', { name: '設定' }).click();
  await page.getByRole('button', { name: 'この端末の記録をすべて削除' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '削除する' }).click();
  await expect(page.getByRole('button', { name: '調査をはじめる' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
  await page.reload();
  await gotoCase01(page);
  await expectBudget(page, 4);
  await expect(page.getByText('0 / 6 件確認済み')).toBeVisible();
});
