import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import type { CaseData } from '../src/domain/types';

export const GAME_CASES: CaseData[] = ['01', '02', '03', '04', '05'].map(
  (id) =>
    JSON.parse(
      readFileSync(new URL(`../data/cases/case-${id}.json`, import.meta.url), 'utf8'),
    ) as CaseData,
);
const case01 = GAME_CASES[0]!;
const case02 = GAME_CASES[1]!;
export const CASE01 = {
  id: case01.id,
  title: case01.title,
  budget: case01.budget,
  docs: {
    ad: 'キャンペーン広告',
    trial: '無料体験者の登録台帳',
    paid: '料金決済の集計',
    retained: '翌月の継続状況',
    memo: '広告担当者のメモ',
    reviews: '利用者の声',
  },
};
export const CASE02_TITLE = case02.title;
export function docTile(page: Page, title: string): Locator {
  return page.getByRole('button').filter({ hasText: title }).and(page.locator('.doc-tile'));
}
export function budgetMeter(page: Page): Locator {
  return page.getByText(/調査予算：残り \d+ \/ \d+/);
}
export async function expectBudget(page: Page, remaining: number, total = CASE01.budget) {
  await expect(budgetMeter(page)).toHaveText(`調査予算：残り ${remaining} / ${total}`);
}
export async function gotoCase(page: Page, data: CaseData) {
  await page.goto(`/#/play/${data.id}`);
  await expect(page.getByRole('heading', { level: 1, name: data.title })).toBeVisible();
}
export async function gotoCase01(page: Page) {
  await gotoCase(page, GAME_CASES[0]!);
}
export async function openDoc(page: Page, title: string): Promise<Locator> {
  await docTile(page, title).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
  return dialog;
}
export async function openAndPin(page: Page, title: string) {
  const dialog = await openDoc(page, title);
  const button = dialog.getByRole('button', { name: '証拠ボードに貼る' });
  if (await button.count()) await button.click();
  else await dialog.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('list', { name: '採用した資料', exact: true })).toContainText(title);
}
export async function goToArticle(page: Page) {
  await page.getByRole('button', { name: '調査報告をまとめる →' }).click();
  await expect(page.getByText('STEP 02 / 調査報告をまとめる', { exact: true })).toBeVisible();
}
export async function fillReport(page: Page, claim = '確認した資料の対象範囲を限定して報告する。') {
  await page.getByRole('textbox', { name: '確認できたこと・採る方針' }).fill(claim);
  await page
    .getByRole('textbox', { name: '未確認の点・判断の前提や留保' })
    .fill('資料だけでは原因や将来の結果は確定しない。');
}
export async function submitArticle(page: Page) {
  await page.getByRole('button', { name: '報告を提出して振り返る' }).click();
  await expect(page.getByText('STEP 03 / 判断を振り返る', { exact: true })).toBeVisible();
}

async function recordDecision(page: Page, c: CaseData, sources: string[], optionId?: string) {
  const definition = c.v2!.decision!;
  const title = (id: string) => c.documents.find((d) => d.id === id)!.title;
  const desk = page.getByRole('region', { name: '意思決定シミュレーション' });
  await desk.getByLabel('優先する目的', { exact: true }).selectOption(definition.objectives[0]!.id);
  const option =
    definition.options.find((o) => o.id === optionId) ??
    definition.options.find((o) => o.cost <= definition.resources)!;
  await desk.getByRole('radio', { name: new RegExp(`^${option.text}`) }).check();
  const support = desk.getByRole('group', { name: '方針を支える資料', exact: true });
  const counter = desk.getByRole('group', { name: '反対の見方・制約を示す資料', exact: true });
  for (const group of [support, counter]) {
    for (const box of await group.getByRole('checkbox').all())
      if (await box.isChecked()) await box.uncheck();
  }
  await support.getByRole('checkbox', { name: title(sources[0]!), exact: true }).check();
  await counter.getByRole('checkbox', { name: title(sources[1]!), exact: true }).check();
  await desk
    .getByRole('textbox', { name: 'この判断が成り立つ前提・不確実な点' })
    .fill('追加情報により見通しが変わる可能性を残す。');
  await desk
    .getByRole('textbox', { name: '目的と根拠を踏まえた選択理由' })
    .fill('確認できた範囲に基づき目的と制約を比べて選択する。');
  await desk.getByRole('button', { name: '判断を記録', exact: true }).click();
}

/** Real UI walkthrough: all evidence is read/pinned, never injected into localStorage. */
export async function prepareV2Case(
  page: Page,
  c: CaseData,
  options: { alternative?: boolean; decisionChoice?: string; experimentChoice?: string } = {},
) {
  await gotoCase(page, c);
  const v = c.v2!;
  const title = (id: string) => c.documents.find((d) => d.id === id)!.title;
  if (v.experiment) {
    const choice =
      v.experiment.choices.find((x) => x.id === options.experimentChoice) ??
      v.experiment.choices[0]!;
    await page.getByRole('button', { name: choice.text, exact: true }).click();
  }
  const selections = v.decoding.map((task) => {
    const accepted = task.options.filter((o) => o.accepted);
    return { task, option: accepted[options.alternative ? accepted.length - 1 : 0]! };
  });
  const path = v.graph.paths[options.alternative ? v.graph.paths.length - 1 : 0]!;
  const needed = [
    ...new Set([
      ...selections.flatMap(({ option }) => option.evidence),
      ...path.flatMap((link) => [link.from, link.to]),
      ...(v.experiment?.revealDocuments ?? []),
      ...(v.decision?.revealDocuments ?? []),
    ]),
  ];
  const initialSources = needed.filter((id) => !v.decision?.revealDocuments.includes(id));
  for (const id of initialSources) await openAndPin(page, title(id));
  if (v.decision) {
    // The initial judgement uses only sources that precede the new information.
    await recordDecision(page, c, initialSources, options.decisionChoice);
    for (const id of v.decision.revealDocuments) await openAndPin(page, title(id));
    await recordDecision(
      page,
      c,
      [initialSources[0]!, v.decision.revealDocuments[0] ?? initialSources[1]!],
      options.decisionChoice,
    );
  }
  if (v.experiment) {
    const choice =
      v.experiment.choices.find((x) => x.id === options.experimentChoice) ??
      v.experiment.choices[0]!;
    const group = page.getByRole('group', {
      name: '比較後の判断（変わらなくても構いません）',
      exact: true,
    });
    await group.getByRole('radio', { name: choice.text, exact: true }).check();
    await group
      .getByRole('textbox', { name: '維持・変更した理由' })
      .fill('開示された情報の範囲と比較条件を確認し、この判断を維持する。');
    await group.getByRole('button', { name: '比較後の判断を記録' }).click();
  }
  for (const { task, option } of selections) {
    const group = page.getByRole('group', { name: task.prompt, exact: true });
    await group.getByRole('radio', { name: option.text, exact: true }).check();
    for (const id of option.evidence)
      await group.getByRole('checkbox', { name: title(id), exact: true }).check();
  }
  for (const link of path) {
    await page.getByLabel('起点となる資料', { exact: true }).selectOption(link.from);
    await page.getByLabel('関係の役割', { exact: true }).selectOption(link.relation);
    await page.getByLabel('結び付ける資料', { exact: true }).selectOption(link.to);
    await page.getByRole('button', { name: '関係を追加', exact: true }).click();
  }
  await goToArticle(page);
  await fillReport(page, selections.map(({ option }) => option.text).join(' '));
}
export async function clearCase01(page: Page) {
  await prepareV2Case(page, GAME_CASES[0]!);
  await submitArticle(page);
}
