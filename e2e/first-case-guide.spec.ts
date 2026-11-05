import { expect, test } from '@playwright/test';
import { GAME_CASES, gotoCase } from './helpers';

test('最初の事件で資料確認から問1の記録まで案内する', async ({ page }, testInfo) => {
  const data = GAME_CASES[0]!;
  await gotoCase(page, data);
  const guide = page.getByRole('region', { name: '次にやること' });
  // 「残っていることの一覧」は置かない。残数はタブのバッジ、状態は問いの行で確かめる。
  const decodingTab = page.getByRole('tab', { name: /解読メモ/ });
  const total = data.v2!.decoding.length;
  await expect(guide).toBeVisible();
  await expect(page.getByText('残っていることの一覧', { exact: true })).toHaveCount(0);
  await expect(decodingTab).toHaveText(`解読メモ0 / ${total}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `/tmp/urameku-guide-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await guide.getByRole('button', { name: 'キャンペーン広告を開く' }).click();
  await expect(page.getByRole('dialog')).toContainText(data.documents[0]!.content);
  await page.getByRole('dialog').getByRole('button', { name: '資料を閉じる' }).click();
  await guide.getByRole('button', { name: '問1を開く' }).click();
  const task = data.v2!.decoding[0]!;
  const group = page.getByRole('group', { name: task.prompt, exact: true });
  await expect(group).toContainText('問 1 ・ 未回答');
  const option = task.options.find((entry) => entry.id === 'paid_cohort')!;
  await page.getByRole('radio', { name: option.text, exact: true }).check();
  const unread = option.evidence.filter((id) => id !== data.documents[0]!.id);
  // 答えだけ選んだ問いは根拠待ち。行に未読の件数が出て、バッジはまだ進まない。
  await expect(group).toContainText('問 1 ・ 根拠待ち');
  await expect(decodingTab).toHaveText(`解読メモ0 / ${total}`);
  for (const id of unread) {
    const doc = data.documents.find((entry) => entry.id === id)!;
    await group.getByRole('button', { name: `${doc.title}を開く`, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(doc.content);
    await page.getByRole('dialog').getByRole('button', { name: '資料を閉じる' }).click();
  }
  await expect(group).toContainText(`問 1 ・ 回答済み ・ 根拠 ${option.evidence.length} 件`);
  await expect(decodingTab).toHaveText(`解読メモ1 / ${total}`);
  await expect(guide.getByRole('button', { name: '問2を開く' })).toBeVisible();
  await page.reload();
  await expect(decodingTab).toHaveText(`解読メモ1 / ${total}`);
  await expect(guide.getByRole('button', { name: '問2を開く' })).toBeVisible();
  const next = data.v2!.decoding[1]!;
  await expect(page.getByRole('group', { name: next.prompt, exact: true })).toContainText(
    '問 2 ・ 未回答',
  );
  await guide.getByRole('button', { name: '問2を開く' }).click();
  await expect(page.getByRole('radio', { name: next.options[0]!.text, exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  );
});
