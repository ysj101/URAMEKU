import { expect, test } from '@playwright/test';
import {
  CASE01,
  docTile,
  expectBudget,
  fillCalc,
  goToArticle,
  gotoCase01,
  openAndPin,
  pinCard,
} from './helpers';

const STORAGE_KEY = 'urameku-mvp-v1';

/** T10 / T11: リロードで進行が復元され、設定の「すべて削除」で初期状態に戻る */
test('リロードで事件・進行・段階が復元され、すべて削除で初期状態に戻る', async ({ page }) => {
  await gotoCase01(page);
  await openAndPin(page, CASE01.docs.trial);
  await openAndPin(page, CASE01.docs.retained);
  await pinCard(page, CASE01.docs.trial).click();
  await pinCard(page, CASE01.docs.retained).click();
  await fillCalc(page, CASE01.tasks.all, '45');
  await goToArticle(page);
  await page.getByRole('button', { name: CASE01.correctFragments[0], exact: true }).click();

  // 保存はデバウンスされる。書き込まれるのを待ってからリロード
  await expect
    .poll(async () => page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY))
    .toContain('"article":["f0"]');
  await page.reload();

  // T10: 事件・段階（記事画面）・進行が復元される
  await expect(page).toHaveURL(/#\/play\/case-01$/);
  await expect(page.getByRole('heading', { level: 2, name: CASE01.title })).toBeVisible();
  await expect(page.getByText('STEP 02 / 記事を組み立てる')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: `断片 1: ${CASE01.correctFragments[0]}（タップで差し替え）`,
    }),
  ).toBeVisible();

  await page.getByRole('button', { name: '← 調査へ戻る' }).click();
  await expectBudget(page, 2);
  await expect(docTile(page, CASE01.docs.trial)).toHaveAccessibleName(/採用済み/);
  await expect(page.getByTestId('link-status')).toContainText(
    `${CASE01.docs.trial} ↔ ${CASE01.docs.retained}`,
  );
  await expect(page.getByRole('textbox', { name: CASE01.tasks.all })).toHaveValue('45');

  // ホームは「前回の続き」になる
  await page.goto('/#/');
  await expect(page.getByRole('button', { name: '前回の続き' })).toBeVisible();

  // T11: 設定 → すべて削除（2 段階確認）
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
  await page.getByRole('button', { name: 'この端末の記録をすべて削除' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('すべての事件の進行とクリア記録を削除します');
  await confirm.getByRole('button', { name: '削除する' }).click();

  // ホームに戻り、初期状態（「調査をはじめる」）になる
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('button', { name: '調査をはじめる' })).toBeVisible();
  await expect(page.getByRole('button', { name: '前回の続き' })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();

  // リロードしても初期状態のまま
  await page.reload();
  await expect(page.getByRole('button', { name: '調査をはじめる' })).toBeVisible();
  await page.goto('/#/play/case-01');
  await expectBudget(page, 4);
  await expect(page.getByText('0 / 6 件確認済み')).toBeVisible();
});
