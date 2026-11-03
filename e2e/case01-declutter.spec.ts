import { expect, test } from '@playwright/test';
import { GAME_CASES, gotoCase, openTask, recordEvidenceBoard, submitArticle } from './helpers';

test('CASE01は各段階で次の操作を1つ示し、補足の機能にも戻れる', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1280, height: 800 });
  const data = GAME_CASES[0]!;
  await gotoCase(page, data);
  await expect(page.getByRole('button', { name: 'ヒントを閉じる', exact: true })).toHaveCount(0);
  // 何を調べる事件か（導入文）は常に見せる。
  await expect(page.getByText(data.intro, { exact: true })).toBeVisible();
  const next = page.getByRole('region', { name: '次にやること' });
  // 押せる主ボタン（無効化された記録済みボタンは数えない）は、各段階で多くても1つ。
  const primary = page.locator('.btn.primary:visible:not([disabled])');
  const expectFocus = async (card: string | RegExp, main: string | RegExp | null) => {
    await expect(next.getByRole('button')).toHaveAccessibleName(card);
    if (main === null) await expect(primary).toHaveCount(0);
    else {
      await expect(primary).toHaveCount(1);
      await expect(primary).toHaveAccessibleName(main);
    }
  };
  const checkStage = async (card: string | RegExp, main: string | RegExp | null, stage: string) => {
    await expectFocus(card, main);
    await expect(page.locator('html')).toHaveJSProperty(
      'scrollWidth',
      await page.locator('html').evaluate((el) => el.clientWidth),
    );
    await page.getByText('残っていることの一覧', { exact: true }).click();
    await expect(page.getByRole('heading', { name: '残っていること', exact: true })).toBeVisible();
    const remaining = page.locator('details.remaining-checklist');
    await expect(remaining).toHaveAttribute('open', '');
    await remaining.locator('summary').click();
    await page.getByText('遊び方', { exact: true }).click();
    await expect(
      page.getByRole('region', { name: '最初の事件で、遊び方を体験しよう' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'この事件を最初からやり直す' }).click();
    const reset = page.getByRole('alertdialog', { name: 'やり直しの確認' });
    await expect(reset).toBeVisible();
    await reset.getByRole('button', { name: 'やめる', exact: true }).click();
    await page.getByText('遊び方', { exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectFocus(card, main);
    await page.screenshot({ path: testInfo.outputPath(`${stage}.png`), fullPage: true });
  };
  await checkStage('キャンペーン広告を開く', 'キャンペーン広告を開く', '01-start');
  const bounds = await primary.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await next.getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText(data.documents[0]!.content);
  await page.getByRole('dialog').getByRole('button', { name: '資料を閉じる' }).click();
  // 問1はすでにデスクに出ているので、カードは控えめにして選択肢を主役にする。
  await checkStage('問1を開く', null, '02-first-doc');
  const opened = new Set([data.documents[0]!.id]);
  for (const task of data.v2!.decoding) {
    await next.getByRole('button').click();
    const group = await openTask(page, task.prompt);
    const option = task.options.find((entry) => entry.accepted)!;
    await group.getByRole('radio', { name: option.text, exact: true }).check();
    for (const id of option.evidence) {
      if (opened.has(id)) continue;
      const doc = data.documents.find((entry) => entry.id === id)!;
      await expect(primary).toHaveCount(1);
      await expect(primary).toHaveAccessibleName(`${doc.title}を開く`);
      await primary.click();
      await expect(page.getByRole('dialog')).toContainText(doc.content);
      await page.getByRole('dialog').getByRole('button', { name: '資料を閉じる' }).click();
      opened.add(id);
    }
    await expect(group.getByRole('status')).toContainText('根拠ありとして記録しました');
  }
  await checkStage(/^証拠ボード：.+を開く$/, /^証拠ボード：.+を開く$/, '03-questions');
  await next.getByRole('button').click();
  await expect(page.getByRole('tab', { name: /証拠ボード/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.v2-next .btn.ghost')).toHaveCount(1);
  await expect(primary).toHaveCount(0);
  await recordEvidenceBoard(page, data);
  await checkStage('調査報告をまとめる →', '調査報告をまとめる →', '04-board');
  await primary.click();
  await expect(page.getByText('STEP 02 / 調査報告をまとめる', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ヒントを閉じる', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ヒントを閉じる', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'ヒントを閉じる', exact: true })).toHaveCount(0);
  await submitArticle(page);
});
