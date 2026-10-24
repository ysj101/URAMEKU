#!/usr/bin/env node
/**
 * アセット容量監査（MVP-043）
 *
 * `assets.manifest.json`（正本）を読み、
 *  1. 種別（category / format）とディレクトリごとの合計サイズ
 *  2. 容量の大きい上位 N ファイル（既定 20）
 *  3. 初回表示（ホーム → 事件一覧 → CASE 01 の調査画面）で参照される画像の合計と、
 *     低速回線（3G 相当 400kbps / 4G 相当 4Mbps）での転送時間の見積もり
 * を出力する。画像ファイルの変換・削除は行わない（読むだけ）。
 *
 * 初回表示の参照は、次のファイルを grep して求める（MVP-043 のスコープで固定）:
 *   src/screens/HomeScreen.tsx, src/screens/CaseSelectScreen.tsx,
 *   src/screens/InvestigationScreen.tsx, src/components/CaseHeader.tsx,
 *   src/app/global.css, src/app/layout.css, index.html
 *  - `assetUrl('...')` / `documentThumbnail(...)` などのヘルパー呼び出し（文字列リテラル）
 *  - CSS の `url('/assets/...')`、HTML の `href="/assets/..."`
 *  - `${...}` を含む動的参照は、ディレクトリ内の同拡張子ファイルを「候補」として
 *    最大 1 ファイル（最も大きいもの）だけ初回分に数える（例: 事件一覧の状態バッジは
 *    初回は全件 `new` なので 1 ファイルしか転送されない）。
 *  - CASE 01 の資料サムネイルは `data/cases/case-01.json` の documents から展開する。
 *
 * 使い方:
 *   npm run audit:assets               # 人が読むレポート（Markdown 風）
 *   npm run audit:assets -- --json     # 機械可読（docs 生成や CI での閾値チェック用）
 *   npm run audit:assets -- --top 30   # 上位 N 件を変更
 *   npm run audit:assets -- --budget 500   # 初回表示の目標（KB）。超過時は終了コード 1
 *
 * 終了コード: 0 = 正常（--budget 指定時は目標以内） / 1 = 目標超過 / 2 = 引数エラー
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MANIFEST_FILE = resolve(ROOT, 'assets.manifest.json');
const MANIFEST_PREFIX = 'public/assets/';

// ---------------------------------------------------------------------------
// 引数
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const asJson = args.includes('--json');
function numberArg(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v) || v <= 0) {
    console.error(`${name} には正の数を指定してください`);
    process.exit(2);
  }
  return v;
}
const topN = numberArg('--top', 20);
const budgetKb = numberArg('--budget', undefined);

// ---------------------------------------------------------------------------
// 回線モデル（実効スループット。ヘッダや TCP スロースタートは含めない下限の目安）
// ---------------------------------------------------------------------------
export const NETWORK_PROFILES = [
  { id: '3g', label: '3G 相当（400kbps）', bitsPerSecond: 400_000 },
  { id: '4g', label: '4G 相当（4Mbps）', bitsPerSecond: 4_000_000 },
];

export function secondsAt(bytes, bitsPerSecond) {
  return (bytes * 8) / bitsPerSecond;
}

export function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ---------------------------------------------------------------------------
// マニフェスト
// ---------------------------------------------------------------------------
function loadManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
  const assets = manifest.assets.filter((a) => a.exists !== false);
  const byRel = new Map(assets.map((a) => [a.path.replace(/^public\/assets\//, ''), a]));
  return { manifest, assets, byRel };
}

function sumBy(assets, keyFn) {
  const out = new Map();
  for (const a of assets) {
    const k = keyFn(a);
    const cur = out.get(k) ?? { bytes: 0, count: 0 };
    cur.bytes += a.bytes;
    cur.count += 1;
    out.set(k, cur);
  }
  return [...out.entries()].map(([key, v]) => ({ key, ...v })).sort((x, y) => y.bytes - x.bytes);
}

// ---------------------------------------------------------------------------
// 初回表示で参照される画像
// ---------------------------------------------------------------------------
const FIRST_VIEW_SOURCES = [
  { file: 'index.html', screen: 'shell' },
  { file: 'src/app/global.css', screen: 'shell' },
  { file: 'src/app/layout.css', screen: 'shell' },
  { file: 'src/screens/HomeScreen.tsx', screen: 'home' },
  { file: 'src/screens/CaseSelectScreen.tsx', screen: 'cases' },
  { file: 'src/components/CaseHeader.tsx', screen: 'case-01' },
  { file: 'src/screens/InvestigationScreen.tsx', screen: 'case-01' },
];

/** `assetUrl('x')` などから相対パスを取り出す（check_asset_refs.mjs と同じ規則） */
// 末尾カンマ付き（prettier が複数行に整形した呼び出し）も拾う
const HELPER_CALL = /\b(assetUrl)\(\s*(['"`])([^'"`]+)\2\s*,?\s*\)/g;
const HELPER_TEMPLATE = /\b(assetUrl)\(\s*`([^`]+)`\s*,?\s*\)/g;
const URL_REF = /(?:url\(\s*['"]?|href=['"]|src=['"])\/?assets\/([^'")\s]+)/g;

export function extractReferences(source) {
  const literal = new Set();
  const dynamic = new Set();
  for (const m of source.matchAll(HELPER_CALL)) {
    if (m[3].includes('${')) dynamic.add(m[3]);
    else literal.add(m[3]);
  }
  for (const m of source.matchAll(HELPER_TEMPLATE)) {
    if (m[2].includes('${')) dynamic.add(m[2]);
    else literal.add(m[2]);
  }
  for (const m of source.matchAll(URL_REF)) literal.add(m[1]);
  return { literal: [...literal], dynamic: [...dynamic] };
}

/** `ui/states/${...}.png` → 同ディレクトリ・同拡張子の候補一覧 */
function expandDynamic(pattern, byRel) {
  const dir = pattern.slice(0, pattern.lastIndexOf('/') + 1);
  const ext = pattern.includes('.') ? pattern.slice(pattern.lastIndexOf('.')) : '';
  const candidates = [];
  for (const [rel, a] of byRel) {
    if (rel.startsWith(dir) && rel.endsWith(ext) && !rel.slice(dir.length).includes('/')) {
      candidates.push(a);
    }
  }
  return candidates.sort((x, y) => y.bytes - x.bytes);
}

function case01DocumentThumbnails(byRel) {
  const caseFile = resolve(ROOT, 'data/cases/case-01.json');
  if (!existsSync(caseFile)) return [];
  const data = JSON.parse(readFileSync(caseFile, 'utf8'));
  return data.documents
    .map((d) => byRel.get(`cases/${data.id}/documents/${d.id}.png`))
    .filter(Boolean);
}

export function collectFirstView(byRel) {
  const items = new Map(); // rel → { asset, screen, via }
  const missing = [];
  const add = (asset, screen, via) => {
    const rel = asset.path.replace(/^public\/assets\//, '');
    if (!items.has(rel)) items.set(rel, { rel, bytes: asset.bytes, size: asset.size, screen, via });
  };

  for (const { file, screen } of FIRST_VIEW_SOURCES) {
    const full = resolve(ROOT, file);
    if (!existsSync(full)) continue;
    const { literal, dynamic } = extractReferences(readFileSync(full, 'utf8'));
    for (const rel of literal) {
      const a = byRel.get(rel);
      if (a) add(a, screen, file);
      else missing.push({ rel, file });
    }
    for (const pattern of dynamic) {
      const [largest] = expandDynamic(pattern, byRel);
      if (largest) add(largest, screen, `${file}（動的: ${pattern} の最大候補）`);
    }
    if (file.endsWith('InvestigationScreen.tsx')) {
      for (const a of case01DocumentThumbnails(byRel))
        add(a, screen, 'DocumentGrid（case-01 の documents）');
    }
  }
  return { items: [...items.values()], missing };
}

/**
 * 「初回操作までに必要」か「後回しにできる」かの分類。
 * - ファビコン・背景・最初の画面（ホーム）の画像は操作開始前に見える → required
 * - 事件一覧・CASE 01 の画像は遷移後に初めて見える → deferrable（遷移時に遅延読み込み）
 * - ただしホームのマスコットは装飾（alt あり・操作に不要）なので、容量が大きい場合は
 *   deferrable に倒せる候補として `decorative` を付ける。
 */
export function classify(item) {
  const decorative = /characters\//.test(item.rel);
  if (item.screen === 'shell') return { phase: 'required', decorative: false };
  if (item.screen === 'home') return { phase: 'required', decorative };
  return { phase: 'deferrable', decorative };
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------
function main() {
  const { manifest, assets, byRel } = loadManifest();
  const total = assets.reduce((s, a) => s + a.bytes, 0);
  const byCategory = sumBy(assets, (a) => a.category ?? '(none)');
  const byFormat = sumBy(assets, (a) => a.format ?? '(none)');
  const byDir = sumBy(assets, (a) => {
    const rel = a.path.replace(MANIFEST_PREFIX, '');
    const parts = rel.split('/');
    return parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
  });
  const top = [...assets].sort((x, y) => y.bytes - x.bytes).slice(0, topN);

  const firstView = collectFirstView(byRel);
  const classified = firstView.items.map((it) => ({ ...it, ...classify(it) }));
  const required = classified.filter((it) => it.phase === 'required');
  const deferrable = classified.filter((it) => it.phase === 'deferrable');
  const sum = (xs) => xs.reduce((s, it) => s + it.bytes, 0);
  const firstViewTotal = sum(classified);
  const requiredTotal = sum(required);
  const requiredNonDecorative = sum(required.filter((it) => !it.decorative));

  const timings = (bytes) =>
    NETWORK_PROFILES.map((p) => ({ ...p, seconds: secondsAt(bytes, p.bitsPerSecond) }));

  const result = {
    manifestVersion: manifest.version,
    generatedAt: manifest.generatedAt,
    assetCount: assets.length,
    totalBytes: total,
    byCategory,
    byFormat,
    byDir,
    top,
    firstView: {
      items: classified,
      missing: firstView.missing,
      totalBytes: firstViewTotal,
      requiredBytes: requiredTotal,
      requiredNonDecorativeBytes: requiredNonDecorative,
      deferrableBytes: sum(deferrable),
      timings: {
        all: timings(firstViewTotal),
        required: timings(requiredTotal),
        requiredNonDecorative: timings(requiredNonDecorative),
      },
    },
    budgetKb,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result);
  }

  if (budgetKb !== undefined && requiredTotal > budgetKb * 1024) {
    console.error(
      `\n初回表示に必要な画像 ${formatKb(requiredTotal)} が目標 ${budgetKb} KB を超えています。`,
    );
    process.exit(1);
  }
}

function printReport(r) {
  const line = (s = '') => console.log(s);
  line(`# アセット容量監査（manifest ${r.manifestVersion} / ${r.generatedAt}）`);
  line();
  line(`- 登録ファイル数: ${r.assetCount}`);
  line(`- 合計: ${formatKb(r.totalBytes)}`);
  line();
  line('## 形式別');
  line();
  line('| 形式 | 件数 | 合計 |');
  line('| --- | ---: | ---: |');
  for (const c of r.byFormat) line(`| ${c.key} | ${c.count} | ${formatKb(c.bytes)} |`);
  line();
  line('## カテゴリ別');
  line();
  line('| カテゴリ | 件数 | 合計 | 割合 |');
  line('| --- | ---: | ---: | ---: |');
  for (const c of r.byCategory) {
    line(
      `| ${c.key} | ${c.count} | ${formatKb(c.bytes)} | ${((c.bytes / r.totalBytes) * 100).toFixed(1)}% |`,
    );
  }
  line();
  line('## ディレクトリ別（上位 15）');
  line();
  line('| ディレクトリ | 件数 | 合計 |');
  line('| --- | ---: | ---: |');
  for (const c of r.byDir.slice(0, 15)) line(`| ${c.key} | ${c.count} | ${formatKb(c.bytes)} |`);
  line();
  line(`## 容量上位 ${r.top.length} ファイル`);
  line();
  line('| # | パス | サイズ | 画素 |');
  line('| ---: | --- | ---: | --- |');
  r.top.forEach((a, i) => {
    const px = Array.isArray(a.size) ? `${a.size[0]}×${a.size[1]}` : '-';
    line(`| ${i + 1} | ${a.path.replace(MANIFEST_PREFIX, '')} | ${formatKb(a.bytes)} | ${px} |`);
  });
  line();
  line('## 初回表示（ホーム → 事件一覧 → CASE 01 調査画面）で参照される画像');
  line();
  line('| 画面 | パス | サイズ | 画素 | 分類 | 参照元 |');
  line('| --- | --- | ---: | --- | --- | --- |');
  for (const it of r.firstView.items) {
    const px = Array.isArray(it.size) ? `${it.size[0]}×${it.size[1]}` : '-';
    const cls = it.phase === 'required' ? (it.decorative ? '必要（装飾）' : '必要') : '後回し可';
    line(`| ${it.screen} | ${it.rel} | ${formatKb(it.bytes)} | ${px} | ${cls} | ${it.via} |`);
  }
  if (r.firstView.missing.length) {
    line();
    line('マニフェストに無い参照:');
    for (const m of r.firstView.missing) line(`- ${m.rel}（${m.file}）`);
  }
  line();
  line('### 合計と転送時間の見積もり');
  line();
  line('| 区分 | 合計 | 3G 相当（400kbps） | 4G 相当（4Mbps） |');
  line('| --- | ---: | ---: | ---: |');
  const row = (label, bytes, t) =>
    line(
      `| ${label} | ${formatKb(bytes)} | ${t[0].seconds.toFixed(1)} 秒 | ${t[1].seconds.toFixed(2)} 秒 |`,
    );
  row('初回操作に必要（ホーム＋共通）', r.firstView.requiredBytes, r.firstView.timings.required);
  row(
    '　うち装飾を除く',
    r.firstView.requiredNonDecorativeBytes,
    r.firstView.timings.requiredNonDecorative,
  );
  row('後回し可（事件一覧・CASE 01）', r.firstView.deferrableBytes, [
    { seconds: secondsAt(r.firstView.deferrableBytes, NETWORK_PROFILES[0].bitsPerSecond) },
    { seconds: secondsAt(r.firstView.deferrableBytes, NETWORK_PROFILES[1].bitsPerSecond) },
  ]);
  row('初回表示 3 画面の合計', r.firstView.totalBytes, r.firstView.timings.all);
  if (r.budgetKb !== undefined) {
    line();
    line(`目標: 初回操作に必要な画像 ${r.budgetKb} KB 以下`);
  }
}

main();
