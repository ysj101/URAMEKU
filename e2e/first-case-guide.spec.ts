import { expect, test } from '@playwright/test';
import { GAME_CASES, gotoCase } from './helpers';

test('最初の事件で資料確認から問1の記録まで案内する', async ({ page }, testInfo) => {
  const data = GAME_CASES[0]!;
  await gotoCase(page, data);
  const guide = page.getByRole('region', { name: '最初の事件で、遊び方を体験しよう' });
  const remaining = page.getByRole('region', { name: '残っていること' });
  await expect(guide).toBeVisible();
  await page.getByRole('button', { name: '残りを確認', exact: true }).click();
  await expect(page.getByRole('heading', { name: '残っていること', exact: true })).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `/tmp/urameku-guide-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await guide.getByRole('button', { name: 'キャンペーン広告を開く' }).click();
  await expect(page.getByRole('dialog')).toContainText(data.documents[0]!.content);
  await page.getByRole('dialog').getByRole('button', { name: /戻る/ }).click();
  await guide.getByRole('button', { name: '問1を開く' }).click();
  const task = data.v2!.decoding[0]!;
  const option = task.options.find((entry) => entry.id === 'paid_cohort')!;
  await page.getByRole('radio', { name: option.text, exact: true }).check();
  await expect(remaining).toContainText('答えは記録済み。まだ読んでいない資料：');
  for (const id of option.evidence) {
    if (id === data.documents[0]!.id) continue;
    const doc = data.documents.find((entry) => entry.id === id)!;
    await remaining
      .getByRole('button', { name: `${doc.title}を開く`, exact: true })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toContainText(doc.content);
    await page.getByRole('dialog').getByRole('button', { name: /戻る/ }).click();
  }
  await expect(guide).toContainText('問1の回答と資料確認ができました。');
  await expect(
    remaining.getByRole('button', { name: `問1：${task.prompt}`, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(guide).toContainText('問1の回答と資料確認ができました。');
  const next = data.v2!.decoding[1]!;
  await remaining.getByRole('button', { name: `問2：${next.prompt}`, exact: true }).click();
  await expect(page.getByRole('radio', { name: next.options[0]!.text, exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  );
});
