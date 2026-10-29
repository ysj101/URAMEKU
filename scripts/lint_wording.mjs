#!/usr/bin/env node
/**
 * ウラメク 文言の読みやすさチェッカー
 *
 * プレイヤーに見える日本語（事件 JSON の問いや説明、data/ui/ja.json、src の画面文言）が
 * 「中学生でも読める」書き方になっているかを機械的に確かめる。
 *  - .yomiyasu-words/flag.txt の語（避けると決めた難しい語）が出たら error
 *  - 1 文が長すぎたら warn（60 字超）／error（100 字超）。事件 JSON と ja.json だけ
 *
 * 使い方:
 *   node scripts/lint_wording.mjs            # 既定の対象を走査
 *   node scripts/lint_wording.mjs --strict   # warn も失敗扱い
 *   node scripts/lint_wording.mjs --no-baseline      # 控えにある既存の指摘も表示する
 *   node scripts/lint_wording.mjs --update-baseline  # 今の指摘を控え（qa/wording-baseline.json）に書き出す
 *   node scripts/lint_wording.mjs path/to/file.json ...  # 対象を限定
 *
 * 控え（baseline）は、この仕組みを入れる前から残っている文言の指摘を一時的に見逃すためのもの。
 * 控えにない新しい指摘だけが失敗になる。控えは減らす方向にだけ更新し、新しい指摘を控えに足さない。
 *
 * 資料本文（documents[].content）は作中の資料なので、語のチェックは warn にとどめ、
 * 文の長さは見ない。手順の全体は docs/CASE_AUTHORING.md「文章の書き方」を見る。
 * 本スクリプトは補助であり、yomiyasu による推敲と人手レビューを置き換えない。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const WARN_LEN = 60;
const ERROR_LEN = 100;

const TARGETS = [
  { dir: 'data/cases', ext: ['.json'] },
  { dir: 'data/ui', ext: ['.json'] },
  { dir: 'src', ext: ['.tsx'] },
];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'archive']);
const SKIP_FILE = /\.test\.tsx?$/;

function readWordList(name) {
  const p = join(ROOT, '.yomiyasu-words', name);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}
const FLAG_WORDS = readWordList('flag.txt');

function listFiles(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listFiles(p, exts, out);
    else if (exts.some((e) => name.endsWith(e)) && !SKIP_FILE.test(name)) out.push(p);
  }
  return out;
}

function collectTargets(args) {
  if (args.length) return args.map((a) => resolve(ROOT, a));
  return TARGETS.flatMap(({ dir, ext }) => listFiles(join(ROOT, dir), ext));
}

/** JSON の文字列を (パス, 値) で列挙する */
function* walkStrings(value, path = '') {
  if (typeof value === 'string') yield { path, value };
  else if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* walkStrings(v, `${path}[${i}]`);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, path ? `${path}.${k}` : k);
}

const JA = /[ぁ-んァ-ヶ一-龥]/;

function splitSentences(text) {
  return text
    .split(/(?<=[。！？])|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function checkText(text, loc, { inWorld = false, lengthCheck = true, key = text } = {}) {
  const hits = [];
  for (const w of FLAG_WORDS) {
    if (text.includes(w))
      hits.push({
        severity: inWorld ? 'warn' : 'error',
        loc,
        match: w,
        text: key,
        note: '避ける語（.yomiyasu-words/flag.txt）。docs/CASE_AUTHORING.md の言い換え例を見る',
      });
  }
  if (lengthCheck && !inWorld) {
    for (const s of splitSentences(text)) {
      if (s.length > ERROR_LEN)
        hits.push({
          severity: 'error',
          loc,
          match: `${s.slice(0, 24)}…（${s.length} 字）`,
          note: `1 文が ${ERROR_LEN} 字を超えている。2 文以上に分ける`,
        });
      else if (s.length > WARN_LEN)
        hits.push({
          severity: 'warn',
          loc,
          match: `${s.slice(0, 24)}…（${s.length} 字）`,
          note: `1 文が ${WARN_LEN} 字を超えている。分けられるか見る`,
        });
    }
  }
  return hits;
}

function scanJson(file) {
  const rel = relative(ROOT, file);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const hits = [];
  for (const { path, value } of walkStrings(data)) {
    if (!JA.test(value)) continue;
    if (/\.id$|^id$|Id$|^schemaVersion$/.test(path)) continue;
    const inWorld = /documents\[\d+\]\.(content|title)$|v2\.board\.excerpts\[\d+\]\.quote$/.test(
      path,
    );
    hits.push(...checkText(value, `${rel}  ${path}`, { inWorld, key: '' }));
  }
  return hits;
}

function scanTsx(file) {
  const rel = relative(ROOT, file);
  const hits = [];
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const t = line.trim();
      if (!JA.test(t) || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      hits.push(...checkText(t, `${rel}:${i + 1}`, { lengthCheck: false }));
    });
  return hits;
}

/** 控えの鍵。tsx は行番号がずれるので、ファイル名と語と行の本文で見分ける */
function baselineKey(h) {
  return `${h.loc.replace(/:\d+$/, '')} | ${h.match} | ${h.text ?? ''}`;
}

const BASELINE_PATH = join(ROOT, 'qa', 'wording-baseline.json');
function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set();
  return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).entries ?? []);
}

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const useBaseline = !argv.includes('--no-baseline') && !argv.includes('--update-baseline');
const files = collectTargets(argv.filter((a) => !a.startsWith('--')));
const allHits = files.flatMap((f) => (f.endsWith('.json') ? scanJson(f) : scanTsx(f)));

if (argv.includes('--update-baseline')) {
  const entries = [...new Set(allHits.map(baselineKey))].sort();
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note: 'lint:wording が仕組み導入前の文言を一時的に見逃すための控え。減らす方向にだけ更新する（--update-baseline）。',
        entries,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `lint:wording  baseline updated: ${entries.length} entries -> ${relative(ROOT, BASELINE_PATH)}`,
  );
  process.exit(0);
}

const baseline = useBaseline ? readBaseline() : new Set();
const hits = allHits.filter((h) => !baseline.has(baselineKey(h)));
const suppressed = allHits.length - hits.length;

let errors = 0;
let warns = 0;
for (const h of hits) {
  if (h.severity === 'error') errors++;
  else warns++;
  console.log(`[${h.severity}] ${h.loc}  "${h.match}"  (${h.note})`);
}
console.log(
  `\nlint:wording  files=${files.length}  flagWords=${FLAG_WORDS.length}  errors=${errors}  warnings=${warns}` +
    `  baseline=${suppressed}` +
    (strict ? '  (--strict)' : ''),
);
process.exit(errors > 0 || (strict && warns > 0) ? 1 : 0);
