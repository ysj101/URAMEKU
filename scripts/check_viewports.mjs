#!/usr/bin/env node
/**
 * MVP-040: スマホ幅（320 / 375 / 390 / 430px）× 各画面のレイアウト検査。
 *
 * 検査項目
 *   (a) 横スクロールが無い: document.documentElement.scrollWidth <= innerWidth
 *   (b) 主要な操作要素（button / a / input / select / textarea / summary）の
 *       getBoundingClientRect() が幅・高さとも 44px 以上（インラインのテキストリンクは除外）
 *   (c) 画面右端からはみ出す要素が無い
 *   (d) スクリーンショット（viewport と全ページ）
 *
 * 前提
 *   - `agent-browser` CLI がインストールされていること（PATH 上）
 *   - `npm run build && npx vite preview --port 4174` が起動していること
 *     （別ポートなら `--base http://localhost:PORT` か環境変数 VIEWPORT_BASE_URL）
 *
 * 使い方
 *   node scripts/check_viewports.mjs [--base URL] [--out DIR] [--widths 320,375]
 *                                    [--screens home,cases,...] [--no-screenshot] [--json PATH]
 *
 * 出力
 *   - 標準出力: 幅 × 画面 の Markdown 表（docs/qa/viewport-report.md に貼る）
 *   - `--out`（既定 qa/screenshots）: スクリーンショット PNG（git には入れない）
 *   - `--json`: 生の計測結果
 *   - 違反が 1 件でもあれば終了コード 1
 *
 * 実装メモ
 *   - agent-browser の `find … click` は履歴が戻る不具合があるため使わず、DOM 操作は `eval` で行う。
 *   - 調査〜結果の状態は localStorage（src/state/persistence.ts の v3 形式）に進行状態を注入して再現する。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// 引数
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return args[i + 1];
}
const BASE = opt('base', process.env.VIEWPORT_BASE_URL ?? 'http://localhost:4174').replace(
  /\/$/,
  '',
);
const OUT = opt('out', 'qa/screenshots');
const WIDTHS = opt('widths', '320,375,390,430')
  .split(',')
  .map((w) => Number(w.trim()))
  .filter(Boolean);
const ONLY = opt('screens', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const NO_SHOT = args.includes('--no-screenshot');
const JSON_OUT = opt('json', '');
const HEIGHT = Number(opt('height', '760'));
const MIN_TAP = 44;
const STORAGE_KEY = 'urameku-mvp-v1';

// ---------------------------------------------------------------------------
// agent-browser ラッパ
// ---------------------------------------------------------------------------
function ab(...cmd) {
  try {
    return execFileSync('agent-browser', cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const detail = String(e.stderr || e.stdout || e.message)
      .trim()
      .split('\n')
      .slice(-3)
      .join(' ');
    throw new Error(`agent-browser ${cmd[0]} failed: ${detail.slice(0, 300)}`);
  }
}
function abEval(js) {
  const raw = ab('eval', '--json', js);
  const parsed = JSON.parse(raw);
  if (!parsed.success) throw new Error(`eval failed: ${parsed.error}`);
  const result = parsed.data.result;
  return typeof result === 'string' ? JSON.parse(result) : result;
}
function waitFor(expr, ms = 5000) {
  ab('wait', '--fn', expr, '--timeout', String(ms));
}
function sleep(ms) {
  ab('wait', String(ms));
}

// ---------------------------------------------------------------------------
// 進行状態（CASE 01 の正解は data/cases/case-01.json を参照。答えは変えない）
// ---------------------------------------------------------------------------
function progress(over = {}) {
  return {
    opened: [],
    pinned: [],
    chosenLink: [],
    calculations: {},
    article: [],
    published: false,
    revealed: false,
    ...over,
  };
}
function save(stage, caseProgress) {
  return {
    version: 3,
    active: 'case-01',
    progress: { 'case-01': caseProgress },
    finished: {},
    session: { stage, lastDocumentId: null },
    revision: 1000,
    savedAt: new Date().toISOString(),
  };
}
const SOLVED = {
  opened: ['ad', 'trial', 'paid', 'retained'],
  pinned: ['trial', 'paid', 'retained'],
  chosenLink: ['trial', 'retained'],
  calculations: { all: '45', paid: '90' },
};

/**
 * 画面定義。
 *   hash:    ルート
 *   save:    注入する localStorage（null なら削除）
 *   after:   表示後に実行する DOM 操作（eval）
 *   ready:   表示完了とみなす式
 *   scope:   計測対象を絞るセレクタ（モーダル時）
 *   allow:   44px 未満を許容する要素（理由付き）。`match` は aria-label / テキスト / class の部分一致
 */
const SCREENS = [
  { id: 'home', hash: '#/', save: null, ready: `!!document.querySelector('.home')` },
  { id: 'cases', hash: '#/cases', save: null, ready: `!!document.querySelector('.case-cards')` },
  {
    id: 'tutorial',
    hash: '#/tutorial',
    save: null,
    ready: `!!document.querySelector('.tutorial')`,
  },
  {
    id: 'encyclopedia',
    hash: '#/encyclopedia',
    save: null,
    ready: `!!document.querySelector('.encyclopedia-tabs')`,
  },
  {
    id: 'settings',
    hash: '#/settings',
    save: null,
    ready: `!!document.querySelector('.settings')`,
  },
  {
    id: 'play-investigate',
    hash: '#/play/case-01',
    save: save('investigate', progress({ opened: ['ad', 'trial'], pinned: ['trial'] })),
    ready: `!!document.querySelector('.desk-grid')`,
  },
  {
    id: 'play-board',
    hash: '#/play/case-01',
    save: save(
      'investigate',
      progress({ ...SOLVED, calculations: { all: '45' }, chosenLink: ['trial'] }),
    ),
    ready: `!!document.querySelector('.evidence-card')`,
  },
  {
    id: 'play-dialog',
    hash: '#/play/case-01',
    save: save('investigate', progress({ opened: ['ad', 'trial'], pinned: ['trial'] })),
    ready: `!!document.querySelector('.desk-grid')`,
    // 既読タイル（再読は無料）を DOM から click してダイアログを開く
    after: `document.querySelector('.doc-tile--opened, .doc-tile--pinned, .doc-tile').click()`,
    readyAfter: `!!document.querySelector('dialog[open]')`,
    scope: 'dialog[open]',
  },
  {
    id: 'play-article',
    hash: '#/play/case-01',
    save: save('article', progress({ ...SOLVED, article: ['f0', 'f1'] })),
    ready: `!!document.querySelector('.article-slots')`,
  },
  {
    id: 'play-result-approved',
    hash: '#/play/case-01',
    save: save('article', progress({ ...SOLVED, article: ['f0', 'f1', 'f2'], published: true })),
    ready: `document.querySelector('.result')?.dataset.settled === 'true'`,
  },
  {
    id: 'play-result-rejected',
    hash: '#/play/case-01',
    save: save(
      'article',
      progress({
        ...SOLVED,
        chosenLink: ['trial', 'paid'],
        article: ['f0', 'f3', 'f5'],
        published: true,
        revealed: true,
      }),
    ),
    ready: `document.querySelector('.result')?.dataset.settled === 'true'`,
  },
];

// ---------------------------------------------------------------------------
// ブラウザ内で実行する計測コード
// ---------------------------------------------------------------------------
const MEASURE = `(() => {
  const MIN = ${MIN_TAP};
  const iw = window.innerWidth;
  const root = document.documentElement;
  // ヘッドレス Chromium は縦スクロールバーが幅を取る（約 15px）。はみ出し判定はレイアウト幅で行う。
  const cw = root.clientWidth || iw;
  const scope = __SCOPE__ ? document.querySelector(__SCOPE__) : document.body;
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: (typeof el.className === 'string' ? el.className : '').trim().slice(0, 80),
    text: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
  });
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.right <= 0 || r.bottom <= 0) return false; // skip-link 等の画面外退避
    return true;
  };
  const targets = [...(scope || document.body).querySelectorAll('button, a, input, select, textarea, summary, [role="button"], [role="tab"]')];
  const small = [];
  for (const el of targets) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    if (el.tagName === 'A' && cs.display === 'inline') continue; // インラインテキストリンクは対象外
    const r = el.getBoundingClientRect();
    if (r.width + 0.5 < MIN || r.height + 0.5 < MIN) {
      small.push({ ...describe(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  const overflow = [];
  for (const el of (scope || document.body).querySelectorAll('*')) {
    if (overflow.length >= 12) break;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > cw + 1 || r.left < -1) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute') continue; // 装飾の絶対配置は overflow: hidden 側で判定
      overflow.push({ ...describe(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
  }
  return {
    iw,
    cw,
    scrollWidth: root.scrollWidth,
    horizontalScroll: root.scrollWidth > cw,
    scrollHeight: root.scrollHeight,
    targets: targets.filter(visible).length,
    small,
    overflow,
  };
})()`;

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const results = [];
const screens = ONLY.length ? SCREENS.filter((s) => ONLY.includes(s.id)) : SCREENS;

function openScreen(screen) {
  // 同一オリジンで localStorage を触るため、まずアプリを開く
  ab('open', `${BASE}/${screen.hash}`);
  const payload = screen.save ? JSON.stringify(JSON.stringify(screen.save)) : null;
  abEval(
    payload
      ? `(localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${payload}), true)`
      : `(localStorage.clear(), true)`,
  );
  ab('reload');
  waitFor(screen.ready);
  if (screen.after) {
    abEval(`(${screen.after}, true)`);
    if (screen.readyAfter) waitFor(screen.readyAfter);
  }
  // 演出（Stamp / PaperCard）の完了待ち
  sleep(400);
}

for (const width of WIDTHS) {
  ab('set', 'viewport', String(width), String(HEIGHT));
  for (const screen of screens) {
    let m;
    try {
      openScreen(screen);
      m = abEval(
        MEASURE.replaceAll('__SCOPE__', screen.scope ? JSON.stringify(screen.scope) : 'null'),
      );
    } catch (e) {
      m = { error: String(e.message || e), horizontalScroll: true, small: [], overflow: [] };
    }
    const shot = path.join(OUT, `${width}-${screen.id}.png`);
    const shotFull = path.join(OUT, `${width}-${screen.id}-full.png`);
    if (!NO_SHOT) {
      try {
        ab('screenshot', shot);
        ab('screenshot', '--full', shotFull);
      } catch {
        /* スクリーンショット失敗は検査結果に影響させない */
      }
    }
    const row = { width, screen: screen.id, ...m, shot, shotFull };
    results.push(row);
    const mark = row.error
      ? 'ERR'
      : row.horizontalScroll || row.small.length || row.overflow.length
        ? 'NG'
        : 'OK';
    console.error(
      `[${mark}] ${width}px ${screen.id.padEnd(22)} scrollWidth=${row.scrollWidth ?? '-'} small=${row.small.length} overflow=${row.overflow.length}${row.error ? ` ${row.error}` : ''}`,
    );
  }
}

try {
  ab('close');
} catch {
  /* 既に閉じていても構わない */
}

// ---------------------------------------------------------------------------
// 出力
// ---------------------------------------------------------------------------
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));

const lines = [];
lines.push(`| 画面 | ${WIDTHS.map((w) => `${w}px`).join(' | ')} |`);
lines.push(`| --- | ${WIDTHS.map(() => '---').join(' | ')} |`);
for (const screen of screens) {
  const cells = WIDTHS.map((w) => {
    const r = results.find((x) => x.width === w && x.screen === screen.id);
    if (!r || r.error) return 'ERR';
    const hs = r.horizontalScroll ? `横スクロール ${r.scrollWidth}` : '横スクロールなし';
    return `${hs} / 44px未満 ${r.small.length} / はみ出し ${r.overflow.length}`;
  });
  lines.push(`| ${screen.id} | ${cells.join(' | ')} |`);
}
console.log(lines.join('\n'));

const details = results.filter((r) => r.error || r.small.length || r.overflow.length);
if (details.length) {
  console.log('\n### 違反の内訳\n');
  for (const r of details) {
    console.log(`- ${r.width}px ${r.screen}${r.error ? ` — ERROR: ${r.error}` : ''}`);
    for (const s of r.small)
      console.log(`  - 44px未満: <${s.tag}.${s.cls}> "${s.text}" ${s.w}×${s.h}`);
    for (const o of r.overflow)
      console.log(`  - はみ出し: <${o.tag}.${o.cls}> "${o.text}" left=${o.left} right=${o.right}`);
  }
}

const failed = results.some(
  (r) => r.error || r.horizontalScroll || r.small.length || r.overflow.length,
);
process.exit(failed ? 1 : 0);
