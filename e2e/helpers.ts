import { expect, type Locator, type Page } from '@playwright/test';

/** CASE 01「消えた55人の利用者」の資料タイトル（data/cases/case-01.json） */
export const CASE01 = {
  id: 'case-01',
  title: '消えた55人の利用者',
  budget: 4,
  docs: {
    ad: 'キャンペーン広告',
    trial: '無料体験者の登録台帳',
    paid: '料金決済の集計',
    retained: '翌月の継続状況',
    memo: '広告担当者のメモ',
    reviews: '利用者の声',
  },
  tasks: {
    all: '無料体験の登録者全体に対する翌月の継続率',
    paid: '有料契約に移行した人の翌月継続率',
  },
  correctFragments: [
    '広告の継続率90%は',
    '有料契約者を分母にした数字',
    '体験登録者全体では45%が継続',
  ],
} as const;

export const CASE02_TITLE = '半額セールの値札';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 調査資料タイル。aria-label は「<題名>、<未調査|調査済み|採用済み>、<コスト文>」 */
export function docTile(page: Page, title: string): Locator {
  return page.getByRole('button', {
    name: new RegExp(`^${escapeRegExp(title)}、(未調査|調査済み|採用済み)、`),
  });
}

/** 証拠ボード上のピンカード（照合の選択ボタン）。aria-label は「<題名>、<未選択|選択中（A）|照合候補（B）>」 */
export function pinCard(page: Page, title: string): Locator {
  return page.getByRole('button', {
    name: new RegExp(`^${escapeRegExp(title)}、(未選択|選択中|照合候補)`),
  });
}

export function budgetMeter(page: Page): Locator {
  return page.getByText(/調査予算：残り \d+ \/ \d+/);
}

export async function expectBudget(page: Page, remaining: number, total = CASE01.budget) {
  await expect(budgetMeter(page)).toHaveText(`調査予算：残り ${remaining} / ${total}`);
}

/** CASE 01 の調査画面を直接開く（保存は空の前提） */
export async function gotoCase01(page: Page) {
  await page.goto(`/#/play/${CASE01.id}`);
  await expect(page.getByRole('heading', { level: 2, name: CASE01.title })).toBeVisible();
  await expect(page.getByText('STEP 01 / 資料を調べる')).toBeVisible();
}

/** 資料を開いてダイアログが出るまで待つ */
export async function openDoc(page: Page, title: string): Promise<Locator> {
  await docTile(page, title).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2, name: title })).toBeVisible();
  return dialog;
}

/** 資料を開いて「証拠ボードに貼る」で採用する（ダイアログは閉じる） */
export async function openAndPin(page: Page, title: string) {
  const dialog = await openDoc(page, title);
  await dialog.getByRole('button', { name: '証拠ボードに貼る' }).click();
  await expect(dialog).toBeHidden();
  await expect(pinCard(page, title)).toBeVisible();
}

/** 検証メモに入力する */
export async function fillCalc(page: Page, prompt: string, value: string) {
  const input = page.getByRole('textbox', { name: prompt });
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

/** 記事画面へ進む */
export async function goToArticle(page: Page) {
  await page.getByRole('button', { name: '記事を組み立てる →' }).click();
  await expect(page.getByText('STEP 02 / 記事を組み立てる')).toBeVisible();
}

/** 断片を順に選ぶ（未使用の断片ボタンは本文そのものが名前） */
export async function pickFragments(page: Page, texts: readonly string[]) {
  for (const [i, text] of texts.entries()) {
    await page.getByRole('button', { name: text, exact: true }).click();
    await expect(
      page.getByRole('button', { name: `断片 ${i + 1}: ${text}（タップで差し替え）` }),
    ).toBeVisible();
  }
}

export async function submitArticle(page: Page) {
  await page.getByRole('button', { name: '記事を提出して評価を見る' }).click();
  await expect(page.getByText('STEP 03 / 編集部の評価')).toBeVisible();
}

/** CASE 01 を正解手順でクリア直前（提出済み）まで進める */
export async function clearCase01(page: Page) {
  await gotoCase01(page);
  await openAndPin(page, CASE01.docs.trial);
  await openAndPin(page, CASE01.docs.paid);
  await openAndPin(page, CASE01.docs.retained);
  await pinCard(page, CASE01.docs.trial).click();
  await pinCard(page, CASE01.docs.retained).click();
  await fillCalc(page, CASE01.tasks.all, '45');
  await fillCalc(page, CASE01.tasks.paid, '90');
  await goToArticle(page);
  await pickFragments(page, CASE01.correctFragments);
  await submitArticle(page);
}
