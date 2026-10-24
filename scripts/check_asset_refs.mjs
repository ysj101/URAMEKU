#!/usr/bin/env node
/**
 * アセット参照チェッカー（MVP-033）
 *
 * `src/**\/*.{ts,tsx,css}`・`index.html`・`public/manifest.webmanifest` から
 *  - 文字列中の `assets/...` / `/assets/...` 参照（CSS の url()、HTML の href 等）
 *  - `assetUrl('...')` の呼び出し（文字列リテラル引数のみ）
 * を抽出し、各参照について
 *  1. `public/` 配下にファイルが実在するか
 *  2. `assets.manifest.json`（正本）に載っているか
 * を検査する。`--serve <baseURL>` を付けると、配信中のサーバーに HEAD を送り
 * 200/304 で返ることも確認する（vite preview / dev サーバーを起動したうえで実行）。
 *
 * 使い方:
 *   node scripts/check_asset_refs.mjs
 *   node scripts/check_asset_refs.mjs --serve http://localhost:4173/URAMEKU/
 *   node scripts/check_asset_refs.mjs --verbose
 *
 * 終了コード: 0 = すべて OK / 1 = 欠落・未登録・HTTP エラーあり
 *
 * 注意:
 *  - `${...}` を含む動的な参照（例: `assets/audio/${id}.wav`）はディレクトリの存在だけを確認し、
 *    「dynamic」として一覧に出す。ファイル単位の検証は `src/data/assets.test.ts` が担う。
 *  - `*.test.ts(x)` は走査対象外（存在しないパスを意図的に使うため）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PUBLIC_DIR = resolve(ROOT, 'public');
const MANIFEST_FILE = resolve(ROOT, 'assets.manifest.json');
const MANIFEST_PREFIX = 'public/';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const serveIndex = args.indexOf('--serve');
const serveBase = serveIndex >= 0 ? args[serveIndex + 1] : undefined;
if (serveIndex >= 0 && !serveBase) {
  console.error('--serve には baseURL を指定してください（例: http://localhost:4173/URAMEKU/）');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// 走査対象
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage']);
const SRC_EXT = /\.(ts|tsx|css)$/;
const TEST_FILE = /\.test\.tsx?$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sourceFiles = [
  ...walk(resolve(ROOT, 'src')).filter((f) => SRC_EXT.test(f) && !TEST_FILE.test(f)),
  resolve(ROOT, 'index.html'),
];

// ---------------------------------------------------------------------------
// 参照の抽出
// ---------------------------------------------------------------------------
/** @type {{ file: string, line: number, ref: string, kind: 'literal' | 'assetUrl' | 'webmanifest' | 'dynamic' }[]} */
const refs = [];

// 文字列中の assets/... 参照。パス文字は英数・-_./ のみ。`${` で止まるので動的部分は含まない。
const LITERAL_RE = /(?:^|[^A-Za-z0-9_\-./])\/?assets\/([A-Za-z0-9_\-./]*)/g;
// assetUrl('...') / assetUrl("...") / assetUrl(`...`)
const ASSET_URL_RE = /\bassetUrl\(\s*(['"`])([^'"`)]*)\1/g;

function pushRef(file, line, ref, kind) {
  if (ref.endsWith('/') || ref === '') {
    refs.push({ file, line, ref, kind: 'dynamic' });
  } else {
    refs.push({ file, line, ref, kind });
  }
}

/** コメントを空白化する（行番号を保つため改行は残す）。URL の `//` は対象外。 */
function blankComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (_, pre) => pre);
}

for (const file of sourceFiles) {
  const text = blankComments(readFileSync(file, 'utf8'));
  const lines = text.split('\n');
  lines.forEach((lineText, i) => {
    // assetUrl() の文字列引数
    for (const m of lineText.matchAll(ASSET_URL_RE)) {
      const arg = m[2];
      const isTemplate = m[1] === '`' && arg.includes('${');
      const stripped = isTemplate ? arg.slice(0, arg.indexOf('${')) : arg;
      const ref = `assets/${stripped.replace(/^\/+/, '')}`;
      pushRef(file, i + 1, isTemplate ? ref.replace(/[^/]*$/, '') : ref, 'assetUrl');
    }
    // 文字列中の assets/...（assetUrl の引数は `assets/` を含まないので重複しない）
    for (const m of lineText.matchAll(LITERAL_RE)) {
      pushRef(file, i + 1, `assets/${m[1]}`, 'literal');
    }
  });
}

// public/manifest.webmanifest の icons[].src
const webmanifestFile = resolve(PUBLIC_DIR, 'manifest.webmanifest');
if (existsSync(webmanifestFile)) {
  const wm = JSON.parse(readFileSync(webmanifestFile, 'utf8'));
  for (const icon of wm.icons ?? []) {
    if (typeof icon.src === 'string') {
      pushRef(webmanifestFile, 0, icon.src.replace(/^\.?\/+/, ''), 'webmanifest');
    }
  }
}

// ---------------------------------------------------------------------------
// 検査
// ---------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
const manifestPaths = new Set(
  manifest.assets.map((a) =>
    a.path.startsWith(MANIFEST_PREFIX) ? a.path.slice(MANIFEST_PREFIX.length) : a.path,
  ),
);

async function headStatus(url) {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (res.status === 405 || res.status === 501)
      res = await fetch(url, { method: 'GET', redirect: 'manual' });
    const type = res.headers.get('content-type') ?? '';
    // SPA フォールバックで index.html(200, text/html) が返るケースを 404 相当として扱う
    const html = /text\/html/.test(type) && !/\.html?$/.test(url);
    return { status: res.status, type, ok: (res.status === 200 || res.status === 304) && !html };
  } catch (err) {
    return { status: 0, type: String(err?.message ?? err), ok: false };
  }
}

let failures = 0;
const seen = new Map(); // ref -> result（同じ参照は 1 回だけ検査）

for (const r of refs) {
  const key = `${r.kind === 'dynamic' ? 'dir:' : ''}${r.ref}`;
  if (!seen.has(key)) {
    const abs = resolve(PUBLIC_DIR, r.ref);
    if (r.kind === 'dynamic') {
      const dirOk = existsSync(abs) && statSync(abs).isDirectory();
      seen.set(key, { exists: dirOk, inManifest: null, http: null });
    } else {
      const exists = existsSync(abs) && statSync(abs).isFile();
      const inManifest = manifestPaths.has(r.ref);
      const http = serveBase
        ? await headStatus(new URL(r.ref, serveBase.replace(/\/?$/, '/')).href)
        : null;
      seen.set(key, { exists, inManifest, http });
    }
  }
}

const results = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
for (const [key, res] of results) {
  const ref = key.replace(/^dir:/, '');
  const where = refs
    .filter((r) => r.ref === ref)
    .map((r) => `${relative(ROOT, r.file)}${r.line ? `:${r.line}` : ''}`);
  if (key.startsWith('dir:')) {
    const mark = res.exists ? 'dyn ' : 'NG  ';
    if (!res.exists) failures++;
    if (verbose || !res.exists)
      console.log(
        `  ${mark} ${ref} (dynamic; directory ${res.exists ? 'exists' : 'MISSING'}) <- ${where.join(', ')}`,
      );
    else console.log(`  ${mark} ${ref} (dynamic)`);
    continue;
  }
  const problems = [];
  if (!res.exists) problems.push('file missing');
  if (!res.inManifest) problems.push('not in manifest');
  if (res.http && !res.http.ok) problems.push(`http ${res.http.status} ${res.http.type}`);
  if (problems.length > 0) {
    failures++;
    console.log(`  NG   ${ref} -> ${problems.join(', ')} <- ${where.join(', ')}`);
  } else {
    const http = res.http ? ` http ${res.http.status}` : '';
    console.log(`  ok   ${ref}${http}${verbose ? ` <- ${where.join(', ')}` : ''}`);
  }
}

console.log('');
console.log(
  `参照 ${refs.length} 件 / ユニーク ${results.length} 件 / マニフェスト ${manifestPaths.size} 件` +
    (serveBase ? ` / HTTP: ${serveBase}` : ''),
);
if (failures > 0) {
  console.log(`== NG: ${failures} 件の参照に問題があります`);
  process.exit(1);
}
console.log(
  '== OK: すべての参照が public/ に実在し、assets.manifest.json に登録済み' +
    (serveBase ? '、HTTP 200/304' : ''),
);
