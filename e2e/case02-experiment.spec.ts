import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { GAME_CASES, gotoCase, openDoc, showDesk } from './helpers';

const data = GAME_CASES[1]!;
const experiment = data.v2!.experiment!;
const storageKey = 'urameku-mvp-v1';

async function fits(page: Page, desk: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await desk.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const problems: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim()) continue;
      const parent = node.parentElement!;
      if (!parent.getClientRects().length) continue;
      // 読み上げ専用の見出し（1px・clip）は画面に出ないので対象外
      const box = parent.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.left < -1 || rect.right > innerWidth + 1) problems.push(node.textContent);
        for (
          let ancestor: HTMLElement | null = parent;
          ancestor && ancestor !== document.body;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          if (
            ['hidden', 'clip'].includes(style.overflowX) &&
            (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
          )
            problems.push(node.textContent);
          if (
            ['hidden', 'clip'].includes(style.overflowY) &&
            (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)
          )
            problems.push(node.textContent);
        }
      }
    }
    return problems;
  });
  expect(clipped).toEqual([]);
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  // 本番の割り当ては事件IDから決まり、CASE02は常に提示B（src/domain/v2Progress.ts）。
  // 保存の conditionId も読み込み時に上書きされるため、提示Aはテスト側で配信JSの
  // 条件の並びを入れ替えて割り当てる（本番コードは変えない）。
  for (const letter of ['B', 'A'] as const) {
    const condition = experiment.conditions.find((item) => item.label === `提示${letter}`)!;
    test(`CASE02 ${letter} ${viewport.width}x${viewport.height}: 選択からコラムまで`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      if (letter === 'A') {
        const from = JSON.stringify(experiment.conditions);
        const to = JSON.stringify([...experiment.conditions].reverse());
        let swapped = false;
        await page.route(/\/assets\/.*\.js$/, async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          if (body.includes(from)) swapped = true;
          await route.fulfill({ response, body: body.replace(from, to) });
        });
        await gotoCase(page, data);
        expect(swapped, '配信JSに提示条件の並びが見つからない').toBe(true);
      } else {
        await gotoCase(page, data);
      }
      const desk = page.getByRole('region', { name: '見え方のミニ実験', exact: true });
      const checkpoint = async (name: string, primaryCount = 0) => {
        await fits(page, desk);
        await expect(desk.locator('.btn.primary:visible')).toHaveCount(primaryCount);
        if (process.env.URAMEKU_SHOTS) {
          const directory = resolve(process.env.URAMEKU_SHOTS);
          const fromRepo = relative(process.cwd(), directory);
          expect(
            isAbsolute(fromRepo) || fromRepo === '..' || fromRepo.startsWith(`..${sep}`),
            'screenshots must be outside the repo',
          ).toBe(true);
          const target = resolve(directory, testInfo.project.name);
          await mkdir(target, { recursive: true });
          await page.screenshot({
            path: resolve(target, `${letter}-${name}-${viewport.width}x${viewport.height}.png`),
            fullPage: true,
          });
          // 固定表示の帯が重ならないよう、ミニ実験の欄だけも保存する
          await desk.screenshot({
            path: resolve(
              target,
              `${letter}-${name}-${viewport.width}x${viewport.height}-desk.png`,
            ),
          });
        }
      };
      await expect(desk.getByRole('heading', { name: condition.label, exact: true })).toBeVisible();
      await expect(desk.getByText(condition.prompt, { exact: true })).toBeVisible();
      // 最初の段階では割り当てた提示だけが出る
      await expect(
        desk.getByRole('heading', { name: letter === 'A' ? '提示B' : '提示A', exact: true }),
      ).toHaveCount(0);
      await expect(desk.getByText(/前から欲しかったスニーカー/)).toContainText(
        '発売時は8,000円で、予算を超えていたので買いませんでした。',
      );
      await expect(desk.getByText(/前から欲しかったスニーカー/)).toContainText(
        '今も欲しい気持ちは変わっていません。',
      );
      await expect(
        desk.getByText('深く考えず、直感で選んでください。あとで変えてもOKです。'),
      ).toBeVisible();
      await expect(desk.locator('.btn.ghost')).toHaveCount(4);
      await expect(desk.getByRole('complementary')).toHaveCount(0);
      await checkpoint('01-experiment-start');
      await desk
        .getByRole('button', {
          name: experiment.choices[letter === 'A' ? 0 : 3]!.text,
          exact: true,
        })
        .click();
      await showDesk(page, 'ミニ実験');
      await expect(desk.getByRole('status')).toContainText('次は資料を読んでみよう');
      await checkpoint('02-initial-choice-made');
      for (const id of experiment.revealDocuments) {
        const document = data.documents.find((d) => d.id === id)!;
        const dialog = await openDoc(page, document.title);
        await expect(
          dialog.getByRole('heading', { name: document.title, exact: true }),
        ).toBeVisible();
        await expect(dialog.getByRole('article')).toContainText(
          document.content.replace(/\s+/g, ' '),
        );
        await dialog.getByRole('button', { name: '資料を閉じる' }).click();
      }
      await showDesk(page, 'ミニ実験');
      await expect(desk.getByRole('heading', { name: '2つの見せ方を比べよう' })).toBeVisible();
      await expect(desk.getByRole('complementary')).toHaveCount(0);
      await checkpoint('03-compare', 1);
      await desk
        .getByRole('radio', { name: experiment.choices[letter === 'A' ? 1 : 0]!.text, exact: true })
        .check();
      await desk
        .getByRole('textbox', { name: 'そう選んだ理由' })
        .fill('予算と使い道を考えて選んだ。');
      await desk.getByRole('button', { name: 'この選択を記録する →' }).click();
      const column = desk.getByRole('complementary', { name: '「お得」は何と比べている？' });
      await expect(column).toContainText('参照価格');
      await expect(column).toContainText('1985年');
      await expect(column).toContainText(
        'セールは参照価格を高く感じさせ、同じ値段でもお得に見せる',
      );
      await expect(column).toContainText('参照価格の考え方そのものが受賞したわけではありません。');
      await expect(column).toContainText(experiment.explanation);
      await expect(desk.getByRole('status').getByRole('complementary')).toHaveCount(0);
      await expect(column).toContainText(
        'セイラーは行動経済学への貢献で、2017年にノーベル経済学賞を受けました。',
      );
      await expect(column).not.toContainText(/(?:アンカリング|参照価格)(?:が|は).*受賞/);
      await expect(column.getByRole('link')).toHaveCount(3);
      await checkpoint('04-final-column');
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!).progress['case-02'].v2.experiment.stage,
            storageKey,
          ),
        )
        .toBe('complete');
      await page.reload();
      await showDesk(page, 'ミニ実験');
      await expect(column).toBeVisible();
    });
  }
}
