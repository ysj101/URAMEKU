import { expect, test } from '@playwright/test';
import { CASE01, goToArticle, gotoCase01, pickFragments, submitArticle } from './helpers';

/**
 * T07: 証拠なし・照合なし・計算なしで見出しだけ正答 → 差し戻し。
 * 正解の資料名・数値は「解説と正解を公開する」を押すまで出ない。
 */
test('見出しだけ正答しても差し戻され、正解は明示操作まで隠れる', async ({ page }) => {
  await gotoCase01(page);
  await goToArticle(page);
  await pickFragments(page, CASE01.correctFragments);
  await submitArticle(page);

  const result = page.locator('.result');
  await expect(page.getByRole('heading', { level: 2, name: '記事を差し戻しました' })).toBeVisible();
  // 見出し 24 点 + 調査予算（上限 6 点）= 30 点（資料・照合・計算は 0）
  await expect(page.getByText('30 / 100', { exact: true })).toBeVisible();

  const reasons = page.getByRole('list', { name: '差し戻しの理由' });
  await expect(reasons.getByRole('listitem')).toHaveCount(3);
  await expect(reasons.locator('[data-track="evidence"]')).toHaveText(
    '必要な裏付け資料が 3 件足りません',
  );
  await expect(reasons.locator('[data-track="link"]')).toHaveText('2 資料の照合が成立していません');
  await expect(reasons.locator('[data-track="calculation"]')).toHaveText(
    '数値検証メモに未入力または誤りが 2 問あります',
  );

  // 正解（資料名・数値・答え合わせ）は表示されない
  await expect(result.getByRole('heading', { name: '答え合わせ' })).toHaveCount(0);
  for (const title of [CASE01.docs.trial, CASE01.docs.paid, CASE01.docs.retained]) {
    await expect(result.getByText(title)).toHaveCount(0);
  }
  await expect(result.getByText(/：45%/)).toHaveCount(0);
  await expect(result.getByText(/：90%/)).toHaveCount(0);

  // 明示操作で公開
  await page.getByRole('button', { name: '解説と正解を公開する' }).click();
  await expect(result.getByRole('heading', { name: '答え合わせ' })).toBeVisible();
  await expect(
    result.getByText(`${CASE01.docs.trial}、${CASE01.docs.paid}、${CASE01.docs.retained}`),
  ).toBeVisible();
  await expect(result.getByText(`${CASE01.docs.trial} ↔ ${CASE01.docs.retained}`)).toBeVisible();
  await expect(result.getByText(`${CASE01.tasks.all}：45%`)).toBeVisible();
  await expect(result.getByText(`${CASE01.tasks.paid}：90%`)).toBeVisible();
  await expect(result.getByText(CASE01.correctFragments.join(' ／ '))).toBeVisible();
  await expect(page.getByRole('button', { name: '解説と正解を公開する' })).toHaveCount(0);

  // 記事を修正する → 断片は残っている
  await page.getByRole('button', { name: '記事を修正する' }).click();
  await expect(page.getByText('STEP 02 / 記事を組み立てる', { exact: true })).toBeVisible();
  for (const [i, text] of CASE01.correctFragments.entries()) {
    await expect(
      page.getByRole('button', { name: `断片 ${i + 1}: ${text}（タップで差し替え）` }),
    ).toBeVisible();
  }
});
