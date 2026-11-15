import { expect, test } from '@playwright/test';
import { GAME_CASES } from './helpers';
import { createProgress } from '../src/domain/game';

test('一覧の7題材と画面番号・URL・見出しが一致する', async ({ page }) => {
  for (const c of GAME_CASES) {
    await page.goto('/#/cases');
    const number = c.id.slice(-2);
    await page.getByRole('button', { name: new RegExp(`^CASE ${number} ${c.title}`) }).click();
    await expect(page).toHaveURL(new RegExp(`#/play/${c.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: c.title, exact: true })).toBeVisible();
    await expect(page.getByText(`CASE-${number} / FICTION`, { exact: true })).toBeVisible();
  }
});

test('旧case-06の途中記録を新case-01のおこづかいの題材で再開する', async ({ page }) => {
  const c = GAME_CASES.find((c) => c.id === 'case-01')!;
  const progress = { ...createProgress(c), opened: ['notice', 'survey'] };
  await page.addInitScript(
    (payload) => {
      localStorage.setItem('urameku-mvp-v1', JSON.stringify(payload));
    },
    {
      version: 4,
      gameVersion: 2,
      active: 'case-06',
      caseRevisions: { 'case-06': c.v2!.revision },
      progress: { 'case-06': progress },
      finished: {},
      session: { stage: 'investigate', lastDocumentId: null },
      revision: 4,
    },
  );
  await page.goto('/');
  await page.getByRole('button', { name: /前回の続き/ }).click();
  await expect(page).toHaveURL(/#\/play\/case-01$/);
  await expect(page.getByRole('heading', { level: 1, name: '平均おこづかい3000円' })).toBeVisible();
  const title = GAME_CASES.find((c) => c.id === 'case-01')!.documents.find(
    (d) => d.id === 'survey',
  )!.title;
  await expect(page.getByRole('button', { name: new RegExp(`^${title}、調査済み`) })).toBeVisible();
});
