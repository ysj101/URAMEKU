import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  GAME_CASES,
  docTile,
  expectBudget,
  goToArticle,
  gotoCase,
  openAndRead,
  openTask,
  prepareV2Case,
  showDesk,
  submitArticle,
} from './helpers';

const completion = '根拠と判断の記録をまとめました';
const storageKey = 'urameku-mvp-v1';

for (const c of GAME_CASES) {
  test(`${c.id}: 計算入力なしで主経路を完了する`, async ({ page }) => {
    await prepareV2Case(page, c);
    await submitArticle(page);
    await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
    await expect(page.locator('input[inputmode="decimal"]')).toHaveCount(0);
    await expect(page.getByText(/評価点：|評価ランク|バイアスが強い/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '資料に沿った解説', exact: true })).toHaveCount(
      0,
    );
  });
}

for (const index of [0, 2]) {
  const c = GAME_CASES[index]!;
  test(`${c.id}: 異なる妥当な解釈と根拠経路も完了する`, async ({ page }) => {
    await prepareV2Case(page, c, { alternative: true, experimentChoice: 'hold' });
    await submitArticle(page);
    await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
  });
}

for (const [caseIndex, policy] of [
  [3, 'switch'],
  [3, 'stop'],
  [3, 'hold'],
  [4, 'investigate'],
  [4, 'hold'],
] as const) {
  const c = GAME_CASES[caseIndex]!;
  test(`${c.id}: 方針 ${policy} を唯一の正解へ矯正せず完了する`, async ({ page }) => {
    await prepareV2Case(page, c, { decisionChoice: policy });
    await submitArticle(page);
    await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
    const text = c.v2!.decision!.options.find((option) => option.id === policy)!.text;
    await expect(page.locator('.v2-history')).toContainText(text);
    await expect(page.getByRole('heading', { name: '条件付きの結果', exact: true })).toBeVisible();
    await expect(
      page.getByText(
        '結果がよかったか悪かったかだけでは、そのときの判断がよかったかどうかは決まりません。',
      ),
    ).toBeVisible();
    await page
      .getByText('ほかの方針を選んでいたらどうなっていたか（実際には起きていない想定）', {
        exact: true,
      })
      .click();
    const alternative = c.v2!.decision!.options.find((option) => option.id !== policy)!;
    await expect(
      page.getByText(`${alternative.text}：${alternative.outcome} ${alternative.tradeoff}`, {
        exact: true,
      }),
    ).toBeVisible();
  });
}

test('実験は初回表示を固定し、保留から判断を変えても途中再開できる', async ({ page }) => {
  const c = GAME_CASES[1]!;
  const definition = c.v2!.experiment!;
  await gotoCase(page, c);
  const desk = page.getByRole('region', { name: '見え方のミニ実験', exact: true });
  const conditionLabel = await desk.getByRole('heading', { level: 3 }).innerText();
  const condition = definition.conditions.find((item) => item.label === conditionLabel)!;
  await expect(desk.getByText(condition.prompt, { exact: true })).toBeVisible();
  await expect(page.locator('.doc-tile')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '情報解読メモ', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(desk.getByRole('heading', { name: conditionLabel, exact: true })).toBeVisible();
  await expect(desk.getByText(condition.prompt, { exact: true })).toBeVisible();
  const initial = definition.choices.find((choice) => choice.id === 'hold')!;
  const updated = definition.choices.find((choice) => choice.id !== initial.id)!;
  await desk.getByRole('button', { name: initial.text, exact: true }).click();
  await expect(desk.getByRole('textbox', { name: '維持・変更した理由' })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toContain('"initialChoice":"hold"');
  await page.reload();
  await showDesk(page, '見え方のミニ実験');
  await expect(desk.getByText(`最初の判断：${initial.text}`, { exact: true })).toBeVisible();
  for (const id of definition.revealDocuments) {
    await openAndRead(page, c.documents.find((document) => document.id === id)!.title);
  }
  await showDesk(page, '見え方のミニ実験');
  await desk.getByRole('radio', { name: updated.text, exact: true }).check();
  const reason = '比較情報を確認して、用途と条件を見直した。';
  await desk.getByRole('textbox', { name: '維持・変更した理由' }).fill(reason);
  await desk.getByRole('button', { name: '比較後の判断を記録', exact: true }).click();
  await expect(desk.getByText(`比較後の判断：${updated.text}`, { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toContain(reason);
  await page.reload();
  await showDesk(page, '見え方のミニ実験');
  await expect(desk.getByText(`最初の判断：${initial.text}`, { exact: true })).toBeVisible();
  await expect(desk.getByText(`比較後の判断：${updated.text}`, { exact: true })).toBeVisible();
  await expect(desk.getByText(reason, { exact: true })).toBeVisible();
});

test('意思決定の理由・初回と更新の履歴を報告途中から復元できる', async ({ page }) => {
  const c = GAME_CASES[3]!;
  await prepareV2Case(page, c, { decisionChoice: 'hold' });
  const claim = await page
    .getByRole('textbox', { name: '確認できたこと・採る方針', exact: true })
    .inputValue();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toContain(claim);
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: '確認できたこと・採る方針', exact: true }),
  ).toHaveValue(claim);
  await page.getByRole('button', { name: '← 調査へ戻る', exact: true }).click();
  await showDesk(page, '意思決定');
  const history = page.getByRole('list', { name: '判断の履歴', exact: true });
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history).toContainText('最初の判断');
  await expect(history).toContainText('更新 1');
  await expect(history).toContainText('確認できた範囲に基づき目的と制約を比べて選択する。');
  await goToArticle(page);
  await submitArticle(page);
  await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
});

test('意思決定の初回判断前は追加資料を開けず、費用も消費しない', async ({ page }) => {
  const c = GAME_CASES[3]!;
  const hidden = c.documents.find(
    (document) => document.id === c.v2!.decision!.revealDocuments[0],
  )!;
  await gotoCase(page, c);
  const tile = docTile(page, hidden.title);
  await expect(tile).toHaveAttribute('aria-disabled', 'true');
  await expect(tile).toHaveAccessibleName(/初回の判断を記録すると開示/);
  // aria-disabled の要素にも誤タップが届いた場合、モーダルと本文は開かない。
  await tile.click({ force: true });
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.desk-status')).toContainText(/最初の判断|初回の判断/);
  await expectBudget(page, c.budget, c.budget);
});

test('資料上の事実誤認と方針・保留を区別し、明示操作後に根拠を示す', async ({ page }) => {
  const c = GAME_CASES[0]!;
  const task = c.v2!.decoding.find((item) => item.options.some((option) => !option.accepted))!;
  const wrong = task.options.find((option) => !option.accepted)!;
  await prepareV2Case(page, c);
  await page.getByRole('button', { name: '← 調査へ戻る', exact: true }).click();
  const group = await openTask(page, task.prompt);
  await group.getByRole('radio', { name: wrong.text, exact: true }).check();
  await expect(page.getByText(wrong.reason, { exact: true })).toHaveCount(0);
  await goToArticle(page);
  await submitArticle(page);
  await expect(
    page.getByRole('heading', { name: 'まだ確認できる点があります', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: '読み取りの確認', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '資料に沿った解説を開く', exact: true }).click();
  await expect(page.getByRole('list', { name: '読み取りの確認', exact: true })).toContainText(
    wrong.reason,
  );
});

for (const width of [320, 375, 390, 430]) {
  test(`幅${width}px・文字200%で解読と報告を完了できる`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await gotoCase(page, GAME_CASES[0]!);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { level: 1, name: GAME_CASES[0]!.title })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    // helper navigates once; preserve the text enlargement on every UI route in this test.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.fontSize = '200%';
      });
    });
    await prepareV2Case(page, GAME_CASES[0]!, { alternative: true });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
      '32px',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    const screenshot = testInfo.outputPath(`viewport-${width}-text200-report.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach(`幅${width}px・文字200%`, { path: screenshot, contentType: 'image/png' });
    await submitArticle(page);
    await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
  });
}

/** Navigate by Tab; programmatic focus/click is deliberately avoided in the keyboard walkthrough. */
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tabで対象へ到達できません: ${await target.getAttribute('aria-label')}`);
}

/** デスクのタブを Tab と Enter で切り替える */
async function keyboardShowDesk(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: label });
  if ((await tab.getAttribute('aria-selected')) === 'true') return;
  await tabTo(page, tab);
  await page.keyboard.press('Enter');
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function keyboardSelect(page: Page, select: Locator, value: string) {
  const index = await select
    .locator('option')
    .evaluateAll(
      (options, wanted) =>
        options.findIndex((option) => (option as HTMLOptionElement).value === wanted),
      value,
    );
  expect(index).toBeGreaterThanOrEqual(0);
  await tabTo(page, select);
  await expect(select).toBeFocused();
  await page.keyboard.press('Space');
  await expect(select).toBeFocused();
  await page.keyboard.press('Home');
  for (let current = 0; current < index; current += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(select).toBeFocused();
  await expect(select).toHaveValue(value);
}

test('マウスとドラッグを使わずTab・矢印・Space・EnterでCASE01を完了する', async ({ page }) => {
  test.skip(
    process.platform === 'darwin',
    'macOS headlessのネイティブselectは最小HTMLでも矢印入力を反映しないため、Linux CIで必須実行する。',
  );
  test.setTimeout(120_000);
  const c = GAME_CASES[0]!;
  const v2 = c.v2!;
  const selections = v2.decoding.map((task) => ({
    task,
    option: task.options.find((option) => option.accepted)!,
  }));
  const path = v2.graph.paths[0]!;
  const needed = new Set([
    ...selections.flatMap(({ option }) => option.evidence),
    ...path.flatMap((link) => [link.from, link.to]),
  ]);
  await gotoCase(page, c);
  for (const document of c.documents.filter((item) => needed.has(item.id))) {
    await tabTo(page, docTile(page, document.title));
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await tabTo(page, dialog.getByRole('button', { name: '戻る', exact: true }));
    await page.keyboard.press('Space');
    await expect(dialog).toBeHidden();
  }
  await keyboardShowDesk(page, '情報解読メモ');
  for (const { task, option } of selections) {
    const group = page.getByRole('group', { name: task.prompt, exact: true });
    const head = group.getByRole('button', { expanded: false });
    if (await head.count()) {
      await tabTo(page, head);
      await page.keyboard.press('Enter');
    }
    await tabTo(page, group.getByRole('radio').first());
    const index = task.options.findIndex((candidate) => candidate.id === option.id);
    // Radio arrow keys both move focus and select; Space also handles the first option.
    await page.keyboard.press('Space');
    for (let current = 0; current < index; current += 1) await page.keyboard.press('ArrowDown');
    await expect(group.getByRole('radio', { name: option.text, exact: true })).toBeChecked();
    await expect(group.getByRole('status')).toContainText('根拠ありとして記録しました');
  }
  await keyboardShowDesk(page, '証拠ボード');
  for (const link of path) {
    await keyboardSelect(page, page.getByLabel('A：起点となる資料', { exact: true }), link.from);
    await keyboardSelect(
      page,
      page.getByLabel('A は B に対して…（関係の役割）', { exact: true }),
      link.relation,
    );
    await keyboardSelect(page, page.getByLabel('B：結び付ける資料', { exact: true }), link.to);
    await tabTo(page, page.getByRole('button', { name: '関係を追加', exact: true }));
    await page.keyboard.press('Enter');
  }
  await tabTo(page, page.getByRole('button', { name: '調査報告をまとめる →', exact: true }));
  await page.keyboard.press('Enter');
  // 任意の補足欄は畳まれているので、summary を Tab と Enter で開く
  await tabTo(page, page.getByText('自分の言葉で補足する（任意）', { exact: true }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('textbox', { name: '確認できたこと・採る方針', exact: true }));
  await page.keyboard.type('確認した対象範囲を限定して報告する。');
  await tabTo(
    page,
    page.getByRole('textbox', { name: '未確認の点・前提・まだ決めきれないこと', exact: true }),
  );
  await page.keyboard.type('調査の対象外と原因の説明は未確認である。');
  await tabTo(page, page.getByRole('button', { name: '報告を提出して振り返る', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: completion, exact: true })).toBeVisible();
});
