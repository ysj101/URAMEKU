import { expect, test } from '@playwright/test';
import { expectStage } from './helpers';

/** ハッシュ直接指定で各画面が開く（URL 共有・リロード耐性） */
test('#/play/case-05 で CASE 05 の調査画面が開く', async ({ page }) => {
  await page.goto('/#/play/case-05');
  await expect(page.getByText(/^CASE-\d{2} \/ FICTION$/)).toBeVisible();
  await expectStage(page, '資料を調べる');
  await expect(page).toHaveURL(/#\/play\/case-05$/);
});

test('#/encyclopedia で図鑑が開く', async ({ page }) => {
  await page.goto('/#/encyclopedia');
  await expect(page.getByRole('heading', { level: 1, name: '図鑑' })).toBeVisible();
});

test('#/settings で設定が開く', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'この端末の記録をすべて削除' })).toBeVisible();
});

test('#/tutorial で遊び方が開く', async ({ page }) => {
  await page.goto('/#/tutorial');
  await expect(page.getByRole('heading', { level: 1, name: '遊び方' })).toBeVisible();
  await expect(page.getByRole('button', { name: '練習をやめて事件一覧へ' })).toBeVisible();
});

test('不明なハッシュはホームにフォールバックする', async ({ page }) => {
  await page.goto('/#/nowhere');
  await expect(page.getByRole('heading', { level: 1, name: /ウラ\s*メク/ })).toBeVisible();
});
