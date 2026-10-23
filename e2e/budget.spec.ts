import { expect, test, type Page } from '@playwright/test';
import { CASE01, docTile, expectBudget, gotoCase01, openDoc } from './helpers';

async function closeDialog(page: Page) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(dialog).toBeHidden();
}

/** T02: 無料資料は予算を減らさない */
test('無料資料を開いても予算は減らない', async ({ page }) => {
  await gotoCase01(page);
  await expectBudget(page, 4);
  await openDoc(page, CASE01.docs.ad);
  await closeDialog(page);
  await expectBudget(page, 4);
  await expect(docTile(page, CASE01.docs.ad)).toHaveAccessibleName(/調査済み、再読は無料/);
});

/** T03: 有料資料を 2 度開いても消費は 1 回分 */
test('有料資料を 2 度開いても予算消費は初回のみ', async ({ page }) => {
  await gotoCase01(page);
  await openDoc(page, CASE01.docs.trial);
  await closeDialog(page);
  await expectBudget(page, 3);
  await openDoc(page, CASE01.docs.trial);
  await closeDialog(page);
  await expectBudget(page, 3);
});

/** T09: 外れ資料 2 件で必要資料を開けなくなり、詰み案内 → 最初からやり直しで復帰 */
test('外れ資料 2 件で詰み案内が出て、最初からやり直すと復帰する', async ({ page }) => {
  await gotoCase01(page);
  await openDoc(page, CASE01.docs.memo);
  await closeDialog(page);
  await openDoc(page, CASE01.docs.reviews);
  await closeDialog(page);
  await expectBudget(page, 2);

  const notice = page
    .getByRole('status')
    .filter({ hasText: '必要な資料を開く調査予算が残っていません' });
  await expect(notice).toBeVisible();

  // window.confirm を承諾して最初からやり直す
  page.once('dialog', (d) => d.accept());
  await notice.getByRole('button', { name: 'この事件を最初からやり直す' }).click();

  await expect(notice).toHaveCount(0);
  await expectBudget(page, 4);
  await expect(page.getByText('0 / 6 件確認済み')).toBeVisible();
  await expect(docTile(page, CASE01.docs.memo)).toHaveAccessibleName(/未調査/);
});
