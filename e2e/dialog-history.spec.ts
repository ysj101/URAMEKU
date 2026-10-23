import { expect, test, type Page } from '@playwright/test';
import { CASE01, openDoc } from './helpers';

/**
 * 資料ダイアログは開くときに history.pushState を積み、閉じるときに戻す。
 * どの経路で閉じても URL ハッシュは `#/play/case-01` のままで、
 * その後の「戻る」は 1 回で事件一覧（`#/cases`）に戻れること（余分な履歴が残らない）。
 */
async function enterCase01ViaList(page: Page) {
  await page.goto('/#/cases');
  await expect(page.getByRole('heading', { level: 1, name: '事件一覧' })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^CASE 01 ${CASE01.title}`) }).click();
  await expect(page).toHaveURL(/#\/play\/case-01$/);
  await expect(page.getByText('STEP 01 / 資料を調べる')).toBeVisible();
}

async function expectClosedAndBackToList(page: Page) {
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/#\/play\/case-01$/);
  await expect(page.getByText('STEP 01 / 資料を調べる')).toBeVisible();
  // 余分な履歴が無ければ 1 回の戻るで事件一覧
  await page.goBack();
  await expect(page).toHaveURL(/#\/cases$/);
  await expect(page.getByRole('heading', { level: 1, name: '事件一覧' })).toBeVisible();
}

const routes: Array<[string, (page: Page) => Promise<void>]> = [
  [
    'ピン（証拠ボードに貼る）',
    async (page) => {
      await page.getByRole('dialog').getByRole('button', { name: '証拠ボードに貼る' }).click();
    },
  ],
  [
    '戻るボタン',
    async (page) => {
      await page.getByRole('dialog').getByRole('button', { name: '戻る' }).click();
    },
  ],
  [
    'Esc キー',
    async (page) => {
      await page.keyboard.press('Escape');
    },
  ],
  [
    'ブラウザの戻る',
    async (page) => {
      await page.goBack();
    },
  ],
];

for (const [label, close] of routes) {
  test(`資料ダイアログを「${label}」で閉じても履歴が崩れない`, async ({ page }) => {
    await enterCase01ViaList(page);
    await openDoc(page, CASE01.docs.ad);
    await expect(page).toHaveURL(/#\/play\/case-01$/);
    await close(page);
    await expectClosedAndBackToList(page);
  });
}
