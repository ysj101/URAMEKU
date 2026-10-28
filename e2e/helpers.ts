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
/** 資料を開いて読み、「戻る」で閉じる。開いた時点で根拠候補になる（貼る操作はない） */
export async function openAndRead(page: Page, title: string) {
  const dialog = await openDoc(page, title);
  await dialog.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(docTile(page, title)).toHaveAccessibleName(/調査済み/);
}
/** 右側デスクのタブを切り替える（既に選択中なら何もしない） */
export async function showDesk(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: label });
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
/** 情報解読メモの問い（アコーディオン）を開いて返す */
export async function openTask(page: Page, prompt: string): Promise<Locator> {
  await showDesk(page, '情報解読メモ');
  const group = page.getByRole('group', { name: prompt, exact: true });
  const head = group.getByRole('button', { expanded: false });
  if (await head.count()) await head.click();
  await expect(group.getByRole('radio').first()).toBeVisible();
  return group;
}
export async function goToArticle(page: Page) {
  await page.getByRole('button', { name: '調査報告をまとめる →' }).click();
  await expect(page.getByText('STEP 02 / 調査報告をまとめる', { exact: true })).toBeVisible();
}
/** 任意の補足欄は <details> に畳まれているので、閉じていれば開いてから書く */
export async function openReportNotes(page: Page) {
  const claim = page.getByRole('textbox', { name: '確認できたこと・採る方針' });
  if (!(await claim.isVisible())) {
    await page.getByText('自分の言葉で補足する（任意）', { exact: true }).click();
  }
  await expect(claim).toBeVisible();
}
export async function fillReport(page: Page, claim = '確認した資料の対象範囲を限定して報告する。') {
  await openReportNotes(page);
  await page.getByRole('textbox', { name: '確認できたこと・採る方針' }).fill(claim);
  await page
    .getByRole('textbox', { name: '未確認の点・前提・まだ決めきれないこと' })
    .fill('資料だけでは原因や将来の結果は確定しない。');
}
export async function submitArticle(page: Page) {
  await page.getByRole('button', { name: '報告を提出して振り返る' }).click();
  await expect(page.getByText('STEP 03 / 判断を振り返る', { exact: true })).toBeVisible();
}

async function recordDecision(page: Page, c: CaseData, sources: string[], optionId?: string) {
  const definition = c.v2!.decision!;
  const title = (id: string) => c.documents.find((d) => d.id === id)!.title;
  await showDesk(page, '意思決定');
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

/** Real UI walkthrough: all evidence is read through the UI, never injected into localStorage. */
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
  for (const id of initialSources) await openAndRead(page, title(id));
  if (v.decision) {
    // The initial judgement uses only sources that precede the new information.
    await recordDecision(page, c, initialSources, options.decisionChoice);
    for (const id of v.decision.revealDocuments) await openAndRead(page, title(id));
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
    await showDesk(page, '見え方のミニ実験');
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
    const group = await openTask(page, task.prompt);
    await group.getByRole('radio', { name: option.text, exact: true }).check();
    // 根拠は参照資料を読んだかどうかから自動判定される（事前に openAndRead 済み）
    await expect(group.getByRole('status')).toContainText('根拠ありとして記録しました');
  }
  await showDesk(page, '証拠ボード');
  for (const link of path) {
    await page.getByLabel('A：起点となる資料', { exact: true }).selectOption(link.from);
    await page
      .getByLabel('A は B に対して…（関係の役割）', { exact: true })
      .selectOption(link.relation);
    await page.getByLabel('B：結び付ける資料', { exact: true }).selectOption(link.to);
    await page.getByRole('button', { name: '関係を追加', exact: true }).click();
  }
  await goToArticle(page);
  await fillReport(page, selections.map(({ option }) => option.text).join(' '));
}
export async function clearCase01(page: Page) {
  await prepareV2Case(page, GAME_CASES[0]!);
  await submitArticle(page);
}
