#!/usr/bin/env node
/**
 * dist/ のスモークテスト（MVP-045）
 *
 * `npm run build` 済みの `dist/` を一時 HTTP サーバー（Node 標準モジュールのみ）で配信し、
 *  - index.html に `<div id="root">` があること
 *  - index.html / manifest.webmanifest / favicon / JS / CSS
 *  - 5 ケース分の表紙と全資料サムネイル（data/cases/*.json の documents[].id → PNG）
 * に HEAD を送って 200 で返ることを確認する。GitHub Pages のような「ただのファイル配信」を
 * 模すため、SPA フォールバックや書き換えは一切しない。
 *
 * 使い方:
 *   npm run build && npm run smoke:dist
 *   VITE_BASE_PATH=/URAMEKU/ npm run build && VITE_BASE_PATH=/URAMEKU/ npm run smoke:dist
 *
 * ベースパスは `VITE_BASE_PATH`（既定 `/`）。dist/index.html 内の JS/CSS 参照から実際の
 * ベースパスを検出し、環境変数と食い違っていればエラーにする。
 *
 * 終了コード: 0 = すべて OK / 1 = 失敗あり / 2 = dist/ が無い
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST = resolve(ROOT, 'dist');
const CASES_DIR = resolve(ROOT, 'data', 'cases');

function normalizeBasePath(raw) {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
}
const BASE = normalizeBasePath(process.env.VITE_BASE_PATH);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html がありません。先に `npm run build` を実行してください。');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// 静的ファイルサーバー（フォールバック無し）
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon',
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  if (!decoded.startsWith(BASE)) return null;
  let rel = decoded.slice(BASE.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const full = normalize(join(DIST, rel));
  if (!full.startsWith(DIST + sep) && full !== DIST) return null; // パストラバーサル防止
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
}

const server = createServer((req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'content-length': statSync(file).size });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

// ---------------------------------------------------------------------------
// 検査対象の列挙
// ---------------------------------------------------------------------------
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const failures = [];
const checks = [];

if (/<div\s+id="root"\s*>/.test(html)) {
  console.log('  ok   index.html に <div id="root"> がある');
} else {
  failures.push('index.html に <div id="root"> がない');
}

const jsPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
// dist が実際にどのベースパスでビルドされたかは JS 参照（<base>assets/index-*.js）から分かる
const builtBase = jsPath?.match(/^(.*\/)assets\/[^/]+\.js$/)?.[1];
if (builtBase && builtBase !== BASE) {
  failures.push(
    `dist は base=${builtBase} でビルドされているが、VITE_BASE_PATH=${BASE} で検証しようとしている（同じ値で build と smoke:dist を実行する）`,
  );
}
const cssPath = html.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
const iconPath = html.match(/<link[^>]+rel="icon"[^>]+href="([^"]+)"/)?.[1];
const manifestPath = html.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/)?.[1];

for (const [label, p] of [
  ['JS', jsPath],
  ['CSS', cssPath],
  ['icon', iconPath],
  ['manifest', manifestPath],
]) {
  if (!p) failures.push(`index.html から ${label} の参照が見つからない`);
  else if (!p.startsWith(BASE))
    failures.push(
      `${label} 参照 ${p} がベースパス ${BASE} で始まっていない（ビルド時の VITE_BASE_PATH を確認）`,
    );
  else checks.push({ label, path: p, type: MIME[extname(p.split('?')[0])] });
}

checks.unshift({ label: 'index', path: BASE, type: 'text/html' });
checks.push({ label: 'index.html', path: `${BASE}index.html`, type: 'text/html' });

const caseFiles = readdirSync(CASES_DIR)
  .filter((f) => /^case-\d+\.json$/.test(f))
  .sort();
if (caseFiles.length !== 5)
  failures.push(`data/cases に 5 件のケースが必要（現在 ${caseFiles.length} 件）`);
let documentCount = 0;
for (const f of caseFiles) {
  const c = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8'));
  checks.push({
    label: `${c.id} cover`,
    path: `${BASE}assets/cases/${c.id}/cover.png`,
    type: 'image/png',
  });
  for (const d of c.documents ?? []) {
    documentCount += 1;
    checks.push({
      label: `${c.id}/${d.id}`,
      path: `${BASE}assets/cases/${c.id}/documents/${d.id}.png`,
      type: 'image/png',
    });
  }
}

// ---------------------------------------------------------------------------
// HEAD で検証
// ---------------------------------------------------------------------------
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
console.log(
  `== smoke ${origin}${BASE} (${checks.length} requests, ${caseFiles.length} cases, ${documentCount} documents)`,
);

for (const { label, path, type } of checks) {
  try {
    const res = await fetch(origin + path, { method: 'HEAD' });
    const ctype = res.headers.get('content-type') ?? '';
    if (res.status === 200 && (!type || ctype.startsWith(type))) {
      console.log(`  200  ${path}`);
    } else {
      failures.push(`${label}: ${path} -> ${res.status} ${ctype} (expected 200 ${type ?? ''})`);
    }
  } catch (e) {
    failures.push(`${label}: ${path} -> ${e.message}`);
  }
}
server.close();

if (failures.length > 0) {
  console.error('== NG');
  for (const f of failures) console.error(`  NG   ${f}`);
  process.exit(1);
}
console.log(`== OK: ${checks.length} 件すべて 200（base = ${BASE}）`);
