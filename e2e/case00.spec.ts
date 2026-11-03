import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type Case00Data from '../data/tutorial/case-00.json';

const case00: typeof Case00Data = JSON.parse(
  readFileSync(new URL('../data/tutorial/case-00.json', import.meta.url), 'utf8'),
);

async function chooseDrinks(page: Page) {
  await expect(page.getByRole('radio', { name: /^Mサイズ/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /^Sサイズ/ }).check();
  await page.getByRole('button', { name: 'これにする →' }).click();
  await expect(page.getByRole('radio', { name: /^Mサイズ/ })).toBeVisible();
  await page.getByRole('radio', { name: /^Lサイズ/ }).check();
  await page.getByRole('button', { name: '資料を開く →' }).click();
}

test('CASE00: 一覧から資料・回答・根拠・報告・解説を体験する', async ({ page }) => {
  await page.goto('/#/cases');
  await page.getByRole('button', { name: 'CASE 00 で遊び方を体験する' }).click();
  await expect(page.getByRole('heading', { name: case00.openingTitle })).toBeVisible();
  await chooseDrinks(page);
  await expect(page.getByRole('button', { name: '答えを選ぶ →' })).toHaveCount(0);
  for (const doc of case00.documents) {
    await page.getByRole('button', { name: new RegExp(`${doc.title}を開く`) }).click();
    await expect(page.getByRole('article')).toContainText(doc.content.replace(/\s+/g, ' '));
  }
  await page.getByRole('button', { name: '答えを選ぶ →' }).click();
  await expect(page.getByRole('heading', { name: '4. 答えと根拠を選ぶ' })).toBeFocused();
  const answer = case00.options.find((option) => option.accepted)!;
  const evidence = case00.excerpts.find((excerpt) => excerpt.supportsAnswer)!;
  await page.getByRole('radio', { name: answer.text }).check();
  await expect(page.getByRole('button', { name: '報告をまとめる →' })).toBeDisabled();
  await page.getByRole('radio', { name: new RegExp(evidence.quote) }).check();
  await page.getByRole('button', { name: '報告をまとめる →' }).click();
  await expect(page.getByText(answer.text)).toBeVisible();
  await expect(page.getByText(case00.explanation)).toHaveCount(0);
  await page.getByRole('button', { name: '報告する →' }).click();
  await expect(page.getByText('CASE 00 調査完了')).toBeVisible();
  const diagram = page.getByRole('img', { name: case00.visualGuide.imageAlt });
  await expect(diagram).toBeVisible();
  expect(await diagram.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(
    true,
  );
  await expect(page.getByText(case00.explanation)).toBeHidden();
  await page.getByText('答え・根拠・詳しい解説').click();
  await expect(page.getByText(case00.explanation)).toBeVisible();
  await expect(page.getByText(case00.limit)).toBeVisible();
  await expect(page.getByRole('region', { name: 'おとり効果を学ぶ' })).toContainText(
    case00.experiment.limit,
  );
  await page.getByRole('button', { name: '← ホーム' }).click();
  await page.reload();
  await page.getByRole('button', { name: '調査をはじめる' }).click();
  await expect(page).toHaveURL(/#\/play\/case-01/);
});

test('CASE00: 狭い画面・文字200%でも各段階が横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/tutorial');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const fits = async () => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  };
  await fits();
  await chooseDrinks(page);
  await fits();
  for (const doc of case00.documents) {
    await page.getByRole('button', { name: new RegExp(`${doc.title}を開く`) }).click();
    await fits();
  }
  await page.getByRole('button', { name: '答えを選ぶ →' }).click();
  await fits();
  await page.getByRole('radio', { name: case00.options[0]!.text }).check();
  await page.getByRole('radio', { name: new RegExp(case00.excerpts[0]!.quote) }).check();
  await page.getByRole('button', { name: '報告をまとめる →' }).click();
  await fits();
  await page.getByRole('button', { name: '報告する →' }).click();
  await fits();
});

async function expectStageFits(page: Page) {
  await expect(page.locator('.case00 button.primary:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  const clipped = await page.locator('.case00').evaluate((root) => {
    const failures: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim() || !node.parentElement?.checkVisibility()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        if (rect.left < -1 || rect.right > window.innerWidth + 1) {
          failures.push(node.textContent.trim());
        }
        for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          if (
            (['hidden', 'clip'].includes(style.overflowX) &&
              (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) ||
            (['hidden', 'clip'].includes(style.overflowY) &&
              (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1))
          )
            failures.push(node.textContent.trim());
        }
      }
    }
    return failures;
  });
  expect(clipped, 'visible text must fit without clipping').toEqual([]);
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  for (const updated of ['S', 'L']) {
    test(`CASE00: S→${updated} ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      const shot = async (name: string) => {
        await expectStageFits(page);
        if (!process.env.URAMEKU_HOOK_SHOTS) return;
        const directory = path.resolve(
          process.env.URAMEKU_HOOK_SHOTS,
          testInfo.project.name,
          `S-${updated}`,
        );
        const repository = path.resolve('.');
        expect(
          directory === repository || directory.startsWith(repository + path.sep),
          'screenshots must be outside the repository',
        ).toBe(false);
        await mkdir(directory, { recursive: true });
        await page.screenshot({
          path: path.join(directory, `${name}-${viewport.width}x${viewport.height}.png`),
          fullPage: true,
        });
      };
      await page.goto('/');
      await page.getByRole('button', { name: '調査をはじめる', exact: true }).click();
      await expect(page).toHaveURL(/#\/tutorial/);
      await expect(page.getByText(case00.lead)).toBeVisible();
      await expect(page.getByText(case00.experiment.initialPrompt)).toBeVisible();
      await expect(page.getByRole('heading', { name: case00.openingTitle })).toBeVisible();
      await expect(page.locator('.case00')).not.toContainText(
        /消えたM|メニューが変わる|おとり|コラム|M追加/,
      );
      await expect(page.locator('.case00 img, .case00 article, .case00 details')).toHaveCount(0);
      await expect(page.getByRole('radio', { name: /^Mサイズ/ })).toHaveCount(0);
      await shot('01-scenario');
      await page.getByRole('radio', { name: /^Sサイズ/ }).check();
      await shot('02-first-choice-made');
      await page.getByRole('button', { name: 'これにする →' }).click();
      await expect(page.getByText('最初に選んだのはSサイズでした。')).toBeVisible();
      await expect(page.getByRole('radio', { name: /^Mサイズ/ })).toBeVisible();
      await expect(page.getByText(case00.experiment.explanation)).toHaveCount(0);
      await shot('03-menu-changed');
      await page.getByRole('radio', { name: new RegExp(`^${updated}サイズ`) }).check();
      await page.getByRole('button', { name: '資料を開く →' }).click();
      await expectStageFits(page);
      for (const doc of case00.documents) {
        await page.getByRole('button', { name: new RegExp(`${doc.title}を開く`) }).click();
        await expect(page.getByRole('article')).toContainText(doc.content.replace(/\s+/g, ' '));
        await expectStageFits(page);
      }
      await shot('05-docs');
      await page.getByRole('button', { name: '答えを選ぶ →' }).click();
      await expectStageFits(page);
      await page
        .getByRole('radio', { name: case00.options.find((option) => option.accepted)!.text })
        .check();
      await page
        .getByRole('radio', {
          name: new RegExp(case00.excerpts.find((excerpt) => excerpt.supportsAnswer)!.quote),
        })
        .check();
      await page.getByRole('button', { name: '報告をまとめる →' }).click();
      await shot('06-report');
      await page.getByRole('button', { name: '報告する →' }).click();
      const learning = page.getByRole('region', { name: 'おとり効果を学ぶ' });
      await expect(learning).toContainText(
        updated === 'S' ? case00.experiment.unchanged : case00.experiment.changed,
      );
      await expect(learning).toContainText('最初：Sサイズ');
      await expect(learning).toContainText(`M追加後：${updated}サイズ`);
      await expect(learning).toContainText(case00.experiment.limit);
      await shot('04-reveal');
      const column = page.getByRole('region', { name: case00.column.title });
      for (const paragraph of case00.column.paragraphs)
        await expect(column).toContainText(paragraph);
      for (const source of case00.column.sources)
        await expect(column.getByRole('link', { name: source.title })).toHaveAttribute(
          'href',
          source.url,
        );
      await shot('07-debrief-column');
      await page.getByText('答え・根拠・詳しい解説').click();
      await expectStageFits(page);
      await page.getByRole('button', { name: '本編へ進む →' }).click();
      await expect(page).toHaveURL(/#\/play\/case-01/);
    });
  }
}
