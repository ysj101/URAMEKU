import { expect, test } from '@playwright/test';
import {
  CASE01,
  CASE02_TITLE,
  expectBudget,
  fillCalc,
  goToArticle,
  openAndPin,
  pickFragments,
  pinCard,
  submitArticle,
} from './helpers';

/**
 * T01 / T04 / T05 / T06 / T08: ホームから CASE 01 を正解手順でクリアし、次の事件へ進む。
 */
test('CASE 01 をホームから正解手順でクリアできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /ウラ\s*メク/ })).toBeVisible();
  await page.getByRole('button', { name: /^事件一覧/ }).click();
  await expect(page).toHaveURL(/#\/cases$/);

  await page.getByRole('button', { name: new RegExp(`^CASE 01 ${CASE01.title}`) }).click();
  await expect(page).toHaveURL(/#\/play\/case-01$/);
  await expect(page.getByRole('heading', { level: 2, name: CASE01.title })).toBeVisible();

  // T01: 6 資料・残予算 4
  await expect(page.getByText('0 / 6 件確認済み')).toBeVisible();
  await expectBudget(page, 4);

  // T04: 必要 3 資料を開いてボードに貼る
  await openAndPin(page, CASE01.docs.trial);
  await openAndPin(page, CASE01.docs.paid);
  await openAndPin(page, CASE01.docs.retained);
  await expectBudget(page, 1);
  await expect(page.getByText('3 / 6 件確認済み')).toBeVisible();

  // T05: 2 枚を照合候補にする
  await pinCard(page, CASE01.docs.trial).click();
  await expect(pinCard(page, CASE01.docs.trial)).toHaveAttribute('aria-pressed', 'true');
  await pinCard(page, CASE01.docs.retained).click();
  await expect(page.getByTestId('link-status')).toContainText(
    `${CASE01.docs.trial} ↔ ${CASE01.docs.retained}`,
  );

  // T06: 検証メモ → 記事 → 断片 3 つ
  await fillCalc(page, CASE01.tasks.all, '45');
  await fillCalc(page, CASE01.tasks.paid, '90');
  await expect(page.getByText('2 / 2 件入力済み')).toBeVisible();
  await goToArticle(page);
  await pickFragments(page, CASE01.correctFragments);
  await expect(page.getByText('3 つ揃いました')).toBeVisible();

  // T08: 掲載承認
  await submitArticle(page);
  await expect(
    page.getByRole('heading', { level: 3, name: '掲載可能な記事になりました！' }),
  ).toBeVisible();
  await expect(page.getByText('96 / 100', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: /編集後記/ })).toBeVisible();
  await expect(page.getByTestId('case-disclaimer')).toHaveText(
    '登場人物・企業・統計・広告はすべて架空です。',
  );

  // 次の事件へ
  await page.getByRole('button', { name: '次の事件へ' }).click();
  await expect(page).toHaveURL(/#\/play\/case-02$/);
  await expect(page.getByRole('heading', { level: 2, name: CASE02_TITLE })).toBeVisible();
  await expect(page.getByText('STEP 01 / 資料を調べる')).toBeVisible();
});
