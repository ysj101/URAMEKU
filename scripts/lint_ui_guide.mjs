#!/usr/bin/env node
/**
 * ウラメク UI 設計ガイド チェッカー
 *
 * 画面の文言と配色が、UI 設計の基本（docs/UI_GUIDE_LINT.md）から外れていないかを
 * 機械的に確かめる。人手レビューの代わりではなく、同じ間違いを繰り返さないための網。
 *
 *  1. ボタンの言葉
 *     - 「戻る」だけで行き先がない（行き先を書く。× は「閉じる」）
 *     - 「OK」「はい」「いいえ」「キャンセル」（押した結果が分かる動詞にする）
 *     - 文字も aria-label も無いボタン（アイコンには言葉を添える）
 *  2. 設定項目の言葉
 *     - aria-pressed / role="switch" のボタンと data/ui/ja.json の settings.* が否定形
 *       （「〜しない」「〜を減らす」「ミュート」など。「〜する」の肯定形にそろえる）
 *  3. コントラスト
 *     - src/app/tokens.css の文字色 × 背景色が 4.5:1（WCAG 1.4.3）を満たす
 *
 * window.confirm の使用と、role="tab" に onKeyDown が無い件は eslint.config.js で見る。
 *
 * 使い方:
 *   node scripts/lint_ui_guide.mjs                   # 既定の対象を走査
 *   node scripts/lint_ui_guide.mjs --no-baseline     # 控えにある既存の指摘も表示する
 *   node scripts/lint_ui_guide.mjs --update-baseline # 今の指摘を控え（qa/ui-guide-baseline.json）に書き出す
 *
 * 控え（baseline）は、この仕組みを入れる前から残っている指摘を一時的に見逃すためのもの。
 * 控えにない新しい指摘だけが失敗になる。控えは減らす方向にだけ更新し、新しい指摘を控えに足さない。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'archive']);
const SKIP_FILE = /\.test\.tsx?$/;

/* ------------------------------------------------------------------
 * 1. 言葉のルール
 * ------------------------------------------------------------------ */

/** 単独では使わないボタン文言。前後の「←」「→」は外して比べる */
const BANNED_LABELS = new Map([
  ['戻る', '行き先を書く（例:「事件一覧へ」）。ダイアログを閉じるなら「閉じる」'],
  ['OK', '押した結果が分かる動詞にする（例:「削除する」「保存して閉じる」）'],
  ['はい', '押した結果が分かる動詞にする（例:「やり直す」）'],
  ['いいえ', '押した結果が分かる動詞にする（例:「やめる」「残す」）'],
  ['キャンセル', '押した結果が分かる動詞にする（例:「やめる」）'],
]);

/** 設定項目に出たら否定形とみなす語。項目名は「〜する」にそろえ、オン = 有効にする */
const NEGATIVE_WORDS = /(しない|減らす|無効|オフにする|ミュート|非表示|禁止|省略する)/;
/** 「ミュートを解除」のように、否定状態を解く操作名は肯定の動作なので通す */
const isNegativeSetting = (text) => NEGATIVE_WORDS.test(text) && !/解除/.test(text);

/** 文字として読める（記号だけではない）か */
const HAS_WORD = /[\p{L}\p{N}]/u;

function stripArrows(text) {
  return text
    .replace(/^[←→«»<>\s]+/, '')
    .replace(/[←→«»<>\s]+$/, '')
    .trim();
}

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

/**
 * `<` の位置から、JSX の開始タグの終わり（`>` の次）を返す。
 * 属性の中の `{() => x}` や文字列に含まれる `>` は数えない。
 */
function tagEnd(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (depth === 0 && (c === '"' || c === "'")) quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i + 1;
  }
  return src.length;
}

/** 開始タグの属性部分から、名前と文字列値（式なら null）を取り出す */
function parseAttrs(tag) {
  const attrs = new Map();
  const re = /([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|\{))?/g;
  let m;
  while ((m = re.exec(tag))) {
    if (m[2] === '{') attrs.set(m[1], null);
    else attrs.set(m[1], m[3] ?? m[4] ?? true);
  }
  return attrs;
}

/**
 * ボタンの中身から、見える文字と、式の中の文字列リテラルを取り出す。
 * ネストしたタグは外し、式 `{...}` は中の 'リテラル' だけ候補として残す。
 */
function innerText(src) {
  let text = '';
  const literals = [];
  let hasExpr = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '<') {
      i = tagEnd(src, i);
    } else if (c === '{') {
      hasExpr = true;
      let depth = 0;
      let j = i;
      for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}' && --depth === 0) break;
      }
      const expr = src.slice(i + 1, j);
      for (const lit of expr.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g)) literals.push(lit[2]);
      i = j + 1;
    } else {
      text += c;
      i++;
    }
  }
  return { text: text.replace(/\s+/g, ' ').trim(), literals, hasExpr };
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

function checkLabel(label, loc, hits) {
  const key = stripArrows(label);
  if (BANNED_LABELS.has(key)) {
    hits.push({
      severity: 'error',
      rule: 'button-label',
      loc,
      match: label,
      note: BANNED_LABELS.get(key),
    });
  }
}

function scanTsx(file) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  const hits = [];
  const re = /<button\b/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index;
    const openEnd = tagEnd(src, open);
    const tag = src.slice(open + '<button'.length, openEnd);
    const attrs = parseAttrs(tag);
    const loc = `${rel}:${lineOf(src, open)}`;
    const selfClosing = tag.trimEnd().endsWith('/>');
    const close = selfClosing ? openEnd : src.indexOf('</button>', openEnd);
    const body = selfClosing ? '' : src.slice(openEnd, close === -1 ? src.length : close);
    const { text, literals, hasExpr } = innerText(body);

    // 1. 単独の「戻る」「OK」など
    const ariaLabel = attrs.get('aria-label');
    for (const label of [text, ...literals, ...(typeof ariaLabel === 'string' ? [ariaLabel] : [])])
      if (label) checkLabel(label, loc, hits);

    // 2. 否定形の設定項目
    const isToggle = attrs.has('aria-pressed') || attrs.get('role') === 'switch';
    if (isToggle) {
      for (const label of [text, ...literals])
        if (label && isNegativeSetting(label))
          hits.push({
            severity: 'error',
            rule: 'positive-setting',
            loc,
            match: label,
            note: '設定項目は「〜する」の肯定形にそろえる。状態は「〜中」、ボタンは押した後の動作で書く',
          });
    }

    // 3. 文字も aria-label も無いボタン
    const labelled =
      attrs.has('aria-label') || attrs.has('aria-labelledby') || attrs.has('title') || hasExpr;
    if (!labelled && !HAS_WORD.test(text))
      hits.push({
        severity: 'error',
        rule: 'icon-only-button',
        loc,
        match: text || '(空)',
        note: 'アイコンや記号だけのボタンには言葉を添える（見える文字か aria-label）',
      });
    re.lastIndex = Math.max(re.lastIndex, openEnd);
  }
  return hits;
}

/** JSON の文字列を (パス, 値) で列挙する */
function* walkStrings(value, path = '') {
  if (typeof value === 'string') yield { path, value };
  else if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* walkStrings(v, `${path}[${i}]`);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, path ? `${path}.${k}` : k);
}

function scanUiJson(file) {
  const rel = relative(ROOT, file);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const hits = [];
  for (const { path, value } of walkStrings(data)) {
    const loc = `${rel}  ${path}`;
    checkLabel(value, loc, hits);
    if (path.startsWith('settings.') && isNegativeSetting(value))
      hits.push({
        severity: 'error',
        rule: 'positive-setting',
        loc,
        match: value,
        note: '設定項目は「〜する」の肯定形にそろえる。状態は「〜中」、ボタンは押した後の動作で書く',
      });
  }
  return hits;
}

/* ------------------------------------------------------------------
 * 3. コントラスト（WCAG 1.4.3）
 * ------------------------------------------------------------------ */

/**
 * 確かめる組み合わせ。文字色 × 背景色。
 * 本文サイズで使う文字は 4.5:1、無効状態の文字は WCAG の例外に当たるが 3:1 を目安にする。
 */
const CONTRAST_PAIRS = [
  {
    fg: ['ink', 'quiet', 'red', 'blue', 'green'],
    bg: ['paper', 'paper-white', 'paper-aged', 'paper-desk', 'paper-note', 'paper-explain'],
    min: 4.5,
  },
  { fg: ['white'], bg: ['ink', 'red', 'blue', 'green'], min: 4.5 },
  { fg: ['border-dashed'], bg: ['paper', 'paper-white'], min: 3 },
];

function readPalette() {
  const css = readFileSync(join(ROOT, 'src/app/tokens.css'), 'utf8');
  const palette = new Map();
  for (const m of css.matchAll(/--palette-([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g))
    palette.set(m[1], m[2]);
  return palette;
}

function luminance(hex) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function scanContrast() {
  const palette = readPalette();
  const hits = [];
  for (const { fg, bg, min } of CONTRAST_PAIRS) {
    for (const f of fg) {
      for (const b of bg) {
        const fc = palette.get(f);
        const bc = palette.get(b);
        if (!fc || !bc) continue;
        const ratio = contrast(fc, bc);
        if (ratio < min)
          hits.push({
            severity: 'error',
            rule: 'contrast',
            loc: 'src/app/tokens.css',
            match: `--palette-${f} on --palette-${b}`,
            text: `${ratio.toFixed(2)}:1`,
            note: `コントラスト ${ratio.toFixed(2)}:1 が ${min}:1 を下回る。文字色を濃くするか、組み合わせを変える`,
          });
      }
    }
  }
  return hits;
}

/* ------------------------------------------------------------------
 * 実行
 * ------------------------------------------------------------------ */

/** 控えの鍵。tsx は行番号がずれるので、ファイル名とルールと文言で見分ける */
function baselineKey(h) {
  return `${h.loc.replace(/:\d+$/, '')} | ${h.rule} | ${h.match}`;
}

const BASELINE_PATH = join(ROOT, 'qa', 'ui-guide-baseline.json');
function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set();
  return new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).entries ?? []);
}

const argv = process.argv.slice(2);
const useBaseline = !argv.includes('--no-baseline') && !argv.includes('--update-baseline');
const tsxFiles = listFiles(join(ROOT, 'src'), ['.tsx']);
const jsonFiles = listFiles(join(ROOT, 'data/ui'), ['.json']);
const allHits = [...tsxFiles.flatMap(scanTsx), ...jsonFiles.flatMap(scanUiJson), ...scanContrast()];

if (argv.includes('--update-baseline')) {
  const entries = [...new Set(allHits.map(baselineKey))].sort();
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note: 'lint:ui が仕組み導入前の指摘を一時的に見逃すための控え。減らす方向にだけ更新する（--update-baseline）。',
        entries,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `lint:ui  baseline updated: ${entries.length} entries -> ${relative(ROOT, BASELINE_PATH)}`,
  );
  process.exit(0);
}

const baseline = useBaseline ? readBaseline() : new Set();
const hits = allHits.filter((h) => !baseline.has(baselineKey(h)));
const suppressed = allHits.length - hits.length;

for (const h of hits) console.log(`[${h.severity}] ${h.rule}  ${h.loc}  "${h.match}"  (${h.note})`);
console.log(
  `\nlint:ui  files=${tsxFiles.length + jsonFiles.length}  errors=${hits.length}  baseline=${suppressed}`,
);
process.exit(hits.length > 0 ? 1 : 0);
