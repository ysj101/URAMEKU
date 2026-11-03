#!/usr/bin/env node
/**
 * ウラメク UI 設計ガイド チェッカー（npm run lint:ui）
 *
 * 見るもの・直し方は docs/UI_GUIDE_LINT.md。ここでは ESLint が扱えないものを見る。
 *  - ボタンと設定項目の言葉（src/**\/*.tsx の <button>、data/ui/ja.json）
 *  - 文字色 × 背景色のコントラスト（src/app/tokens.css の用途トークン）
 *
 * 使い方:
 *   node scripts/lint_ui_guide.mjs                   # 既定の対象を走査
 *   node scripts/lint_ui_guide.mjs --no-baseline     # 控えにある既存の指摘も表示する
 *   node scripts/lint_ui_guide.mjs --update-baseline # 今の指摘を控え（qa/ui-guide-baseline.json）に書き出す
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { ROOT, listFiles, runWithBaseline, walkStrings } from './lib/lint_common.mjs';

/* ------------------------------------------------------------------
 * 言葉
 * ------------------------------------------------------------------ */

/** 単独では使わないボタン文言。前後の「←」「→」は外して比べる */
const BANNED_LABELS = new Map([
  ['戻る', '行き先を書く（例:「事件一覧へ」）。ダイアログを閉じるなら「閉じる」'],
  ['OK', '押した結果が分かる動詞にする（例:「削除する」「保存して閉じる」）'],
  ['はい', '押した結果が分かる動詞にする（例:「やり直す」）'],
  ['いいえ', '押した結果が分かる動詞にする（例:「やめる」「残す」）'],
  ['キャンセル', '押した結果が分かる動詞にする（例:「やめる」）'],
]);

/** 設定項目に出たら否定形とみなす語。「ミュートを解除」のように否定状態を解く操作名は通す */
const NEGATIVE_WORDS = /(しない|減らす|無効|オフにする|ミュート|非表示|禁止|省略する)/;
const isNegativeSetting = (text) => NEGATIVE_WORDS.test(text) && !/解除/.test(text);

const stripArrows = (text) => text.replace(/^[←→«»<>\s]+|[←→«»<>\s]+$/g, '');

function checkLabel(label, loc, hits) {
  const key = stripArrows(label);
  if (BANNED_LABELS.has(key))
    hits.push({ rule: 'button-label', loc, match: label, note: BANNED_LABELS.get(key) });
}

function checkSetting(label, loc, hits) {
  if (isNegativeSetting(label))
    hits.push({
      rule: 'positive-setting',
      loc,
      match: label,
      note: '設定項目は「〜する」の肯定形にそろえる。状態は「〜中」、ボタンは押した後の動作で書く',
    });
}

/** 文字として読める（記号だけではない）か */
const HAS_WORD = /[\p{L}\p{N}]/u;

/**
 * JSX 要素の子から、見える文字と、式の中の文字列リテラルを集める。
 * 式 `{...}` があれば hasExpr を立て、中身が分からないボタンは「言葉あり」とみなす。
 */
function collectLabels(node, out = { labels: [], hasExpr: false }) {
  if (ts.isJsxText(node)) {
    const text = node.text.replace(/\s+/g, ' ').trim();
    if (text) out.labels.push(text);
  } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text.trim()) out.labels.push(node.text.trim());
  } else {
    if (ts.isJsxExpression(node)) out.hasExpr = true;
    // コールバックが値を返すと forEachChild が止まるので、戻り値を返さない
    ts.forEachChild(node, (child) => {
      collectLabels(child, out);
    });
  }
  return out;
}

function attrValue(attributes, name) {
  for (const a of attributes.properties) {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== name) continue;
    if (!a.initializer) return true;
    return ts.isStringLiteral(a.initializer) ? a.initializer.text : null;
  }
  return undefined;
}

function scanTsx(file) {
  const rel = relative(ROOT, file);
  const sf = ts.createSourceFile(
    rel,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const hits = [];
  const visit = (node) => {
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (opening && opening.tagName.getText() === 'button') {
      const loc = `${rel}:${sf.getLineAndCharacterOfPosition(opening.getStart()).line + 1}`;
      const attr = (name) => attrValue(opening.attributes, name);
      const collected = { labels: [], hasExpr: false };
      if (ts.isJsxElement(node)) for (const c of node.children) collectLabels(c, collected);
      const { labels, hasExpr } = collected;
      const ariaLabel = attr('aria-label');
      for (const label of typeof ariaLabel === 'string' ? [...labels, ariaLabel] : labels)
        checkLabel(label, loc, hits);
      if (attr('aria-pressed') !== undefined || attr('role') === 'switch')
        for (const label of labels) checkSetting(label, loc, hits);
      const labelled =
        hasExpr || ['aria-label', 'aria-labelledby', 'title'].some((a) => attr(a) !== undefined);
      if (!labelled && !labels.some((l) => HAS_WORD.test(l)))
        hits.push({
          rule: 'icon-only-button',
          loc,
          match: labels.join(' ') || '(空)',
          note: 'アイコンや記号だけのボタンには言葉を添える（見える文字か aria-label）',
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function scanUiJson(file) {
  const rel = relative(ROOT, file);
  const hits = [];
  for (const { path, value } of walkStrings(JSON.parse(readFileSync(file, 'utf8')))) {
    const loc = `${rel}  ${path}`;
    checkLabel(value, loc, hits);
    // settings.* の項目名だけ。note など説明文は対象にしない
    if (path.startsWith('settings.') && !/\.(note|body|description)$/.test(path))
      checkSetting(value, loc, hits);
  }
  return hits;
}

/* ------------------------------------------------------------------
 * コントラスト（WCAG 1.4.3）
 * ------------------------------------------------------------------ */

/**
 * 確かめる用途トークンの組み合わせ（文字色 × 背景色）。docs/DESIGN_TOKENS.md の表と同じ。
 * 本文サイズの文字は 4.5:1。無効状態の文字は WCAG の例外だが 3:1 を目安にする。
 */
const SURFACES = [
  'bg',
  'surface',
  'surface-aged',
  'surface-desk',
  'surface-note',
  'surface-explain',
];
const CONTRAST_PAIRS = [
  { fg: 'ink', bg: SURFACES, min: 4.5 },
  { fg: 'quiet', bg: SURFACES, min: 4.5 },
  { fg: 'accent', bg: ['bg', 'surface', 'surface-aged'], min: 4.5 },
  { fg: 'info', bg: ['bg', 'surface'], min: 4.5 },
  { fg: 'success', bg: ['bg', 'surface'], min: 4.5 },
  { fg: 'ink-inverse', bg: ['ink', 'info', 'accent'], min: 4.5 },
  { fg: 'warning', bg: ['ink'], min: 4.5 },
  { fg: 'disabled', bg: ['bg', 'surface'], min: 3 },
].flatMap(({ fg, bg, min }) => bg.map((b) => ({ fg, bg: b, min })));

/** tokens.css の `--color-*` を `var()` をたどって色コードに解決する */
function readColors() {
  const css = readFileSync(join(ROOT, 'src/app/tokens.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const vars = new Map();
  for (const m of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  const resolve = (name) => {
    const v = vars.get(name);
    const ref = v?.match(/^var\((--[\w-]+)\)$/);
    return ref ? resolve(ref[1]) : v?.match(/^#[0-9a-fA-F]{6}$/)?.[0];
  };
  return (name) => resolve(`--color-${name}`);
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
  const color = readColors();
  const hits = [];
  for (const { fg, bg, min } of CONTRAST_PAIRS) {
    const [fc, bc] = [color(fg), color(bg)];
    if (!fc || !bc) continue;
    const ratio = contrast(fc, bc).toFixed(2);
    if (Number(ratio) < min)
      hits.push({
        rule: 'contrast',
        loc: 'src/app/tokens.css',
        // 比率も鍵に入れ、控えにある組み合わせでも今より悪くなったら失敗にする
        match: `--color-${fg} on --color-${bg} = ${ratio}:1`,
        note: `${min}:1 を下回る。文字色を濃くするか、組み合わせを変える（docs/DESIGN_TOKENS.md）`,
      });
  }
  return hits;
}

/* ------------------------------------------------------------------
 * 実行
 * ------------------------------------------------------------------ */

const tsxFiles = listFiles(join(ROOT, 'src'), ['.tsx']);
const jsonFiles = listFiles(join(ROOT, 'data/ui'), ['.json']);
process.exit(
  runWithBaseline({
    name: 'lint:ui',
    baselinePath: join(ROOT, 'qa', 'ui-guide-baseline.json'),
    argv: process.argv.slice(2),
    hits: [...tsxFiles.flatMap(scanTsx), ...jsonFiles.flatMap(scanUiJson), ...scanContrast()],
    keyOf: (h) => `${h.loc.replace(/:\d+$/, '')} | ${h.rule} | ${h.match}`,
    format: (h) => `[${h.rule}] ${h.loc}  "${h.match}"  (${h.note})`,
    summary: `files=${tsxFiles.length + jsonFiles.length}`,
  }),
);
