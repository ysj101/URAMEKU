import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { CaseData } from '../src/domain/types';
import { prepareV2Case, submitArticle } from './helpers';

const case07 = JSON.parse(
  readFileSync(new URL('../data/cases/case-07.json', import.meta.url), 'utf8'),
) as CaseData;

test('標準ケース case-07 は一覧の CASE 02 に出て、主経路で完了できる', async ({ page }) => {
  await page.goto('/#/cases');
  const card = page.getByRole('button', {
    name: new RegExp(`^CASE 02 ${case07.title}、難易度 標準`),
  });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/#\/play\/case-07$/);
  await expect(page.getByText(/^CASE-02 \/ FICTION$/)).toBeVisible();
  await prepareV2Case(page, case07);
  await submitArticle(page);
  await expect(page.getByRole('heading', { name: '根拠と判断の記録をまとめました' })).toBeVisible();
  await page.getByRole('button', { name: '資料に沿った解説を開く' }).click();
  await expect(page.getByTestId('case-disclaimer')).toContainText('架空');
});

test('標準ケース case-07 は別経路（先生のメモ）でも完了できる', async ({ page }) => {
  await prepareV2Case(page, case07, { alternative: true });
  await submitArticle(page);
  await expect(page.getByRole('heading', { name: '根拠と判断の記録をまとめました' })).toBeVisible();
});
