import { expect, test } from '@playwright/test';
import { analyze, parseOtlpJson, type JourneyEvent } from 'journeygap-grafana/analysis';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';

const definition = JSON.parse(readFileSync('qa/journeygap.analysis.json', 'utf8'));
const practice = JSON.parse(readFileSync('data/tutorial/case-00.json', 'utf8'));
let receiver: Server;
let events: JourneyEvent[];
test.beforeEach(async () => {
  events = [];
  receiver = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4186');
    res.setHeader('Access-Control-Allow-Headers', 'content-type,idempotency-key,x-faro-session-id');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    const envelope = JSON.parse(body);
    expect(envelope.meta.session.id).toBe(req.headers['x-faro-session-id']);
    const parsed = parseOtlpJson(JSON.stringify(envelope.traces), definition);
    events.push(...parsed.journeyEvents);
    res.writeHead(202).end();
  });
  await new Promise<void>((resolve) => receiver.listen(14328, '127.0.0.1', resolve));
});
test.afterEach(async () => {
  receiver.closeAllConnections();
  await new Promise<void>((resolve) => receiver.close(() => resolve()));
});
async function report(journey: string) {
  const journeyDefinition = definition.services[0].journeys.find(
    (item: { id: string }) => item.id === journey,
  );
  return analyze(
    events.filter((event) => event.journeyId === journey),
    journeyDefinition,
    Date.now(),
  );
}

test('real SDK → Faro → JourneyGap aggregate report for CASE00 and displayed CASE01', async ({
  page,
}) => {
  const bodies: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/collect/test-app') && request.method() === 'POST')
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
  await expect(page).toHaveURL(/play\/case-06/);
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
    if (request.url().endsWith('/collect/test-app') && request.method() === 'POST') posts++;
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
  await page.goto('/#/play/case-01');
  await page.waitForTimeout(5200);
  expect((await report('case01-report')).observedStarts).toBe(0);
  expect((await report('case01-reading')).observedStarts).toBe(0);
  let aborted = 0;
  await page.route('**/collect/test-app', (route) => {
    aborted++;
    return route.abort();
  });
  await page.goto('/#/play/case-06');
  await page.getByRole('button', { name: 'メニュー', exact: true }).click();
  await page.getByRole('menuitem', { name: '調査報告へ進む（記録が未完でも）' }).click();
  await page.getByRole('button', { name: '報告を提出して振り返る' }).click();
  await expect(page.getByTestId('v2-result')).toBeVisible();
  await expect.poll(() => aborted).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByTestId('v2-result')).toBeVisible();
});
