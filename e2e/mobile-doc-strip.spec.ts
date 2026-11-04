import { expect, test, type Page } from '@playwright/test';
import { CASE01, docTile, gotoCase01, openDoc } from './helpers';

/**
 * #179: スマホ幅では調査資料を横スクロールの 1 列にし、デスクを初期表示に入れる。
 * mobile-chromium では 375×812 に合わせ、chromium では 1280px で変化がないことを確かめる。
 */

const strip = (page: Page) => page.locator('.v2-docs .document-grid');

async function expectNoPageOverflow(page: Page) {
  const html = page.locator('html');
  await expect(html).toHaveJSProperty('scrollWidth', await html.evaluate((el) => el.clientWidth));
}

test.describe('スマホ幅の資料列', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'スマホ幅だけ');
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoCase01(page);
  });

  test('資料列だけが横に伸び、次にやることとデスクのタブが初期表示に入る', async ({
    page,
  }, testInfo) => {
    await expectNoPageOverflow(page);
    const list = strip(page);
    // 列の中は横に続き、次のカードが途中で切れて見える
    const metrics = await list.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      snap: getComputedStyle(el).scrollSnapType,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.snap).toContain('x');
    const tiles = page.locator('.doc-tile');
    await expect(tiles).toHaveCount(6);
    const right = await list.evaluate((el) => el.getBoundingClientRect().right);
    const boxes = await tiles.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })),
    );
    const partlyVisible = boxes.filter((b) => b.left < right && b.right > right);
    expect(partlyVisible.length).toBe(1);

    // 812px 高の初期表示に「次にやること」と、デスクのタブ列が入る
    const height = page.viewportSize()!.height;
    const next = await page.getByRole('region', { name: '次にやること' }).boundingBox();
    expect(next!.y + next!.height).toBeLessThanOrEqual(height);
    const tabs = await page.getByRole('tablist', { name: 'デスクの切り替え' }).boundingBox();
    expect(tabs!.y + tabs!.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: testInfo.outputPath('doc-strip-375.png') });
  });

  test('Tab だけで全カードに届き、焦点のカードは列の中に見える', async ({ page }) => {
    const tiles = page.locator('.doc-tile');
    await tiles.first().focus();
    for (let i = 0; i < 6; i += 1) {
      if (i > 0) await page.keyboard.press('Tab');
      const tile = tiles.nth(i);
      await expect(tile).toBeFocused();
      await expect(tile).toBeInViewport({ ratio: 0.99 });
      const inside = await tile.evaluate((el) => {
        const list = el.closest('.document-grid')!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return r.left >= list.left - 0.5 && r.right <= list.right + 0.5;
      });
      expect(inside).toBe(true);
    }
    // 6 枚目まで寄せてもページ全体は横に伸びない
    await expectNoPageOverflow(page);
  });

  test('既読のチェックと開けない錠の印が列の中でも見える', async ({ page }, testInfo) => {
    await openDoc(page, CASE01.docs.ad);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '資料を閉じる' }).click();
    await expect(dialog).toBeHidden();
    const read = docTile(page, CASE01.docs.ad);
    await expect(read).toHaveAccessibleName(/調査済み/);
    await expect(read.locator('.doc-tile__status')).toContainText('読んだ');
    await expect(read.locator('.doc-tile__status .doc-tile__icon')).toBeInViewport();

    // 有料 4 件を開いて予算を使い切ると、残りの有料資料は錠と理由付きで開けなくなる
    for (const title of [
      CASE01.docs.trial,
      CASE01.docs.paid,
      CASE01.docs.retained,
      CASE01.docs.memo,
    ]) {
      await openDoc(page, title);
      await dialog.getByRole('button', { name: '資料を閉じる' }).click();
      await expect(dialog).toBeHidden();
    }
    const locked = docTile(page, CASE01.docs.reviews);
    await expect(locked).toHaveAttribute('aria-disabled', 'true');
    await locked.focus();
    await expect(locked.locator('.doc-tile__reason')).toContainText('予算不足');
    await expect(locked.locator('.doc-tile__reason .doc-tile__icon')).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('doc-strip-375-states.png') });
  });
});

test('1280px では資料は縦 1 列のままで横スクロールしない', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'デスクトップ幅だけ');
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoCase01(page);
  const list = strip(page);
  const metrics = await list.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    lefts: [...el.querySelectorAll('.doc-tile')].map((t) => t.getBoundingClientRect().left),
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  expect(new Set(metrics.lefts).size).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('doc-strip-1280.png') });
});
