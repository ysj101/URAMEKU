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
  // 「残っていることの一覧」は置かない。残数はタブのバッジだけで分かる。
  const decodingTab = page.getByRole('tab', { name: /解読メモ/ });
  const boardTab = page.getByRole('tab', { name: /証拠ボード/ });
  const questions = data.v2!.decoding.length;
  const checkStage = async (
    card: string | RegExp,
    main: string | RegExp | null,
    stage: string,
    badges: { decoding: string; board: string },
  ) => {
    await expectFocus(card, main);
    await expect(page.locator('html')).toHaveJSProperty(
      'scrollWidth',
      await page.locator('html').evaluate((el) => el.clientWidth),
    );
    await expect(page.getByText('残っていることの一覧', { exact: true })).toHaveCount(0);
    await expect(decodingTab).toHaveText(badges.decoding);
    await expect(boardTab).toHaveText(badges.board);
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
  const boardTotal = data.v2!.board!.tasks.length;
  const start = { decoding: `解読メモ0 / ${questions}`, board: `証拠ボード0 / ${boardTotal}` };
  await checkStage('キャンペーン広告を開く', 'キャンペーン広告を開く', '01-start', start);
  const bounds = await primary.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await next.getByRole('button').click();
  await expect(page.getByRole('dialog')).toContainText(data.documents[0]!.content);
  await page.getByRole('dialog').getByRole('button', { name: '資料を閉じる' }).click();
  // 問1はすでにデスクに出ているので、カードは控えめにして選択肢を主役にする。
  await checkStage('問1を開く', null, '02-first-doc', start);
  const opened = new Set([data.documents[0]!.id]);
  for (const task of data.v2!.decoding) {
    await next.getByRole('button').click();
    const group = await openTask(page, task.prompt);
    await expect(group).toContainText('未回答');
    const option = task.options.find((entry) => entry.accepted)!;
    await group.getByRole('radio', { name: option.text, exact: true }).check();
    // 答えだけでは根拠待ち。問いの行に未読の件数が出て、バッジはまだ進まない。
    const unread = option.evidence.filter((id) => !opened.has(id));
    if (unread.length > 0) {
      await expect(group).toContainText(`回答済み ・ まだ読んでいない資料 ${unread.length} 件`);
    }
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
    await expect(group).toContainText(`回答済み ・ 根拠 ${option.evidence.length} 件`);
    const done = data.v2!.decoding.indexOf(task) + 1;
    await expect(decodingTab).toHaveText(
      done === questions ? '解読メモ完了' : `解読メモ${done} / ${questions}`,
    );
  }
  await checkStage(/^証拠ボード：.+を開く$/, /^証拠ボード：.+を開く$/, '03-questions', {
    decoding: '解読メモ完了',
    board: start.board,
  });
  await next.getByRole('button').click();
  await expect(page.getByRole('tab', { name: /証拠ボード/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.v2-next .btn.ghost')).toHaveCount(1);
  await expect(primary).toHaveCount(0);
  await recordEvidenceBoard(page, data);
  await checkStage('調査報告をまとめる →', '調査報告をまとめる →', '04-board', {
    decoding: '解読メモ完了',
    board: '証拠ボード完了',
  });
  await primary.click();
  await expect(page.getByText('STEP 02 / 調査報告をまとめる', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ヒントを閉じる', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ヒントを閉じる', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'ヒントを閉じる', exact: true })).toHaveCount(0);
  await submitArticle(page);
});
