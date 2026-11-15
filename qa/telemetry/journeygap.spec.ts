import { expect, test } from '@playwright/test';
import { createRelay } from '@journeygap/relay';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const definition = JSON.parse(readFileSync('qa/journeygap.relay.local.json', 'utf8'));
const practice = JSON.parse(readFileSync('data/tutorial/case-00.json', 'utf8'));
const token = 'synthetic-local-test-admin-token-only';
let relay: ReturnType<typeof createRelay>;
let directory: string;
test.beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'urameku-telemetry-'));
  relay = createRelay({
    config: { ...definition, allowedOrigins: ['http://localhost:4186'] },
    databasePath: join(directory, 'events.db'),
    adminToken: token,
  });
  await relay.listen(14328, '127.0.0.1');
});
test.afterEach(async () => {
  await relay?.close();
  rmSync(directory, { recursive: true, force: true });
});
async function report(journey: string) {
  const response = await fetch(`http://127.0.0.1:14328/admin/v1/report?journey=${journey}&days=7`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  return response.json();
}

test('real SDK → OTLP → Relay → aggregate report for CASE00 and displayed CASE01', async ({
  page,
}) => {
  const bodies: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/v1/traces') && request.method() === 'POST')
      bodies.push(request.postData() ?? '');
  });
  await page.goto('/#/tutorial');
  await expect(page.getByRole('button', { name: '送信を許可する' })).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 740 });
  const textScale = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: test.info().outputPath('consent-320px-text200.png'),
    fullPage: true,
  });
  await textScale.evaluate((element) => element.remove());
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.waitForTimeout(5200);
  expect(bodies).toEqual([]);
  await page.getByRole('button', { name: '送信を許可する' }).click();
  await page.getByRole('radio', { name: /^Sサイズ/ }).check();
  await page.getByRole('button', { name: 'これにする →' }).click();
  await page.getByRole('radio', { name: /^Lサイズ/ }).check();
  await page.getByRole('button', { name: '資料を開く →' }).click();
  for (const doc of practice.documents)
    await page.getByRole('button', { name: `${doc.title}を開く`, exact: false }).click();
  await page.getByRole('button', { name: '答えを選ぶ →' }).click();
  await page.getByRole('radio', { name: practice.options[0].text }).check();
  await page.getByRole('radio', { name: new RegExp(practice.excerpts[0].quote) }).check();
  await page.getByRole('button', { name: '報告をまとめる →' }).click();
  await page.getByRole('button', { name: '報告する →' }).click();
  await expect.poll(async () => (await report('onboarding')).observedCompletions).toBe(1);
  await page.getByRole('button', { name: '本編へ進む →' }).click();
  await expect(page).toHaveURL(/play\/case-01/);
  const doc = page.locator('.doc-tile').first();
  await doc.click();
  // Use the application's dialog close button without assuming document content.
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /閉じる/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'メニュー', exact: true }).click();
  await page.getByRole('menuitem', { name: '調査報告へ進む（記録が未完でも）' }).click();
  const sentinel = 'PRIVATE-NOTE-DO-NOT-EXPORT';
  await page.getByText('自分の言葉で補足する（任意）', { exact: true }).click();
  await page.getByRole('textbox', { name: '確認できたこと・採る方針' }).fill(sentinel);
  await page.getByRole('button', { name: '報告を提出して振り返る' }).click();
  await expect(page.getByTestId('v2-result')).toBeVisible();
  await expect.poll(async () => (await report('case01-report')).observedCompletions).toBe(1);
  expect((await report('case01-reading')).observedCompletions).toBe(1);
  const onboarding = await report('onboarding');
  expect(onboarding.observedStarts).toBe(1);
  expect(onboarding.outOfOrderEvents).toBe(0);
  expect((await report('case01-report')).outOfOrderEvents).toBe(0);
  expect(bodies.join('')).not.toContain(sentinel);
  expect(bodies.join('')).not.toContain(practice.options[0].text);
  await page.reload();
  await page.waitForTimeout(5200);
  // A restored submitted report is not a new start/completion.
  expect((await report('case01-report')).observedStarts).toBe(1);
  expect((await report('case01-report')).observedCompletions).toBe(1);
});

test('refusal and immediate withdrawal discard pending events; cross-tab revocation propagates', async ({
  page,
  context,
}) => {
  let posts = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/v1/traces') && request.method() === 'POST') posts++;
  });
  await page.goto('/#/tutorial');
  await page.getByRole('button', { name: '送信を断る' }).click();
  await page.waitForTimeout(5200);
  expect(posts).toBe(0);
  await page.getByRole('button', { name: '送信を許可する' }).click();
  await page.getByRole('button', { name: '送信を止める' }).click();
  await page.waitForTimeout(5200);
  expect(posts).toBe(0);
  expect((await report('onboarding')).observedStarts).toBe(0);
  await page.getByRole('button', { name: '送信を許可する' }).click();
  const other = await context.newPage();
  await other.goto('/#/settings');
  await expect(other.getByRole('button', { name: '送信を止める' })).toBeVisible();
  await other.getByRole('button', { name: '送信を止める' }).click();
  await expect(page.getByText('送信は停止中です。', { exact: true })).toBeVisible();
  await other.close();
  await page.goto('/#/settings');
  await page.getByRole('button', { name: '送信を許可する' }).click();
  await page.getByRole('button', { name: 'この端末の記録をすべて削除', exact: true }).click();
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  const keys = await page.evaluate(() => ({
    host: localStorage.getItem('urameku-journeygap-consent'),
    sdk: localStorage.getItem('journeygap.consent.v1'),
    session: sessionStorage.getItem('journeygap.session.v1'),
  }));
  expect(keys).toEqual({ host: null, sdk: null, session: null });
  await page.goto('/#/settings');
  await expect(page.getByText('送信は停止中です。', { exact: true })).toBeVisible();
});

test('other cases create no CASE01 journeys; blocked transport does not prevent submission', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByRole('button', { name: '送信を許可する' }).click();
  await page.goto('/#/play/case-03');
  await page.waitForTimeout(5200);
  expect((await report('case01-report')).observedStarts).toBe(0);
  expect((await report('case01-reading')).observedStarts).toBe(0);
  let aborted = 0;
  await page.route('**/v1/traces', (route) => {
    aborted++;
    return route.abort();
  });
  await page.goto('/#/play/case-01');
  await page.getByRole('button', { name: 'メニュー', exact: true }).click();
  await page.getByRole('menuitem', { name: '調査報告へ進む（記録が未完でも）' }).click();
  await page.getByRole('button', { name: '報告を提出して振り返る' }).click();
  await expect(page.getByTestId('v2-result')).toBeVisible();
  await expect.poll(() => aborted).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByTestId('v2-result')).toBeVisible();
});
