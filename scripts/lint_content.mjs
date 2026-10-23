#!/usr/bin/env node
/**
 * ウラメク コンテンツ簡易チェッカー（MVP-017）
 *
 * data/**\/*.json と src/**\/*.tsx の文字列を走査し、
 *  - 心理診断・人格/能力の断定に見える表現
 *  - 実在企業・サービス・メディア名（簡易リスト）
 * を検出して一覧表示する。error が 1 件でもあれば終了コード 1。
 *
 * 使い方:
 *   node scripts/lint_content.mjs            # 既定の対象を走査
 *   node scripts/lint_content.mjs --strict   # warn も失敗扱い
 *   node scripts/lint_content.mjs path/to/file.json ...  # 対象を限定
 *
 * 誤検知は ALLOW_PATTERNS（行単位の許容）に追加する。
 * 注意: 本スクリプトは機械的な補助であり、人手レビュー（docs/reviews/）を置き換えない。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

/** 走査対象（既定） */
const TARGETS = [
  { dir: 'data', ext: ['.json'] },
  { dir: 'src', ext: ['.tsx'] },
];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage']);
const SKIP_FILE = /\.test\.tsx?$/;

/**
 * 検出パターン。
 * severity: 'error' = 出荷前に必ず直す / 'warn' = 文脈を確認する
 */
const RULES = [
  // --- 心理診断・人格/能力の断定 ---
  {
    id: 'diagnosis-word',
    severity: 'error',
    re: /診断/g,
    note: '「診断」は否定文（〜しません）以外で使わない',
  },
  {
    id: 'personality',
    severity: 'error',
    re: /性格|人格|気質|体質/g,
    note: 'ユーザーの性格・人格に言及しない',
  },
  {
    id: 'you-are-type',
    severity: 'error',
    re: /あなた(は|の)[^。、\n]{0,12}(タイプ|型|傾向|バイアス|思考)/g,
    note: '「あなたは○○タイプ/バイアス」等の個人断定',
  },
  {
    id: 'ability',
    severity: 'error',
    re: /(判断力|能力|知能|IQ|頭)(が|は|の)?(低|高|ない|弱|強|不足)/g,
    note: 'ユーザーの能力評価',
  },
  {
    id: 'ability-word',
    severity: 'warn',
    re: /能力|知能|IQ|偏差値|適性|向いて(い)?な/g,
    note: '能力・適性への言及。文脈を確認',
  },
  {
    id: 'bias-strong',
    severity: 'error',
    re: /バイアスが(強|弱|ある|ない)|に(陥|はま)りやすい(人|タイプ)/g,
    note: '個人のバイアス傾向の断定',
  },
  {
    id: 'absolute-claim',
    severity: 'warn',
    re: /(必ず|常に|絶対に|全員|例外なく)[^。\n]{0,20}(影響|判断|感じ|選ぶ|騙)/g,
    note: '学術概念の説明が断定的すぎないか確認（ゲーム内の誤答選択肢は許容）',
  },
  // --- 実在企業・サービス・メディア（簡易リスト。必要に応じて追加） ---
  {
    id: 'real-brand',
    severity: 'error',
    re: /(Amazon|アマゾン|Google|グーグル|Apple|アップル社|Meta|Facebook|Instagram|Twitter|TikTok|YouTube|LINE株式会社|Yahoo|ヤフー|楽天|メルカリ|Netflix|Spotify|Uber|Airbnb|Starbucks|スターバックス|マクドナルド|McDonald|Nike|ナイキ|Adidas|アディダス|ユニクロ|UNIQLO|無印良品|イオン|セブン(イレブン|‐イレブン|-イレブン)|ローソン|ファミリーマート|トヨタ|TOYOTA|ホンダ|日産|ソニー|SONY|パナソニック|任天堂|Nintendo|ソフトバンク|SoftBank|NTT|ドコモ|KDDI|au(?=[^a-z])|三菱|三井|住友|みずほ|日経|朝日新聞|読売新聞|毎日新聞|産経|NHK|フジテレビ|日本テレビ|TBS|テレビ朝日|Wikipedia|ウィキペディア|ChatGPT|OpenAI)/g,
    note: '実在企業・サービス・メディア名',
  },
  {
    id: 'real-person',
    severity: 'warn',
    re: /(カーネマン|Kahneman|トヴェルスキー|Tversky|セイラー|Thaler|チャルディーニ|Cialdini|アリエリー|Ariely)/g,
    note: '実在研究者名。出典明記が必要なら docs 側で扱う',
  },
];

/** 許容パターン（ヒット位置の前 8 文字〜後 16 文字に一致すれば無視。否定文などに使う） */
const ALLOW_PATTERNS = [
  /診断(するものではありません|は行いません|を行いません|しない|には使わない)/,
  /心理特性を(断定|診断)するものではありません/,
];

function listFiles(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) listFiles(p, exts, out);
    else if (exts.some((e) => name.endsWith(e)) && !SKIP_FILE.test(name)) out.push(p);
  }
  return out;
}

function collectTargets(args) {
  if (args.length) return args.map((a) => resolve(ROOT, a));
  return TARGETS.flatMap(({ dir, ext }) => listFiles(join(ROOT, dir), ext));
}

function scanFile(file) {
  const hits = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        const ctx = line.slice(Math.max(0, m.index - 8), m.index + m[0].length + 16);
        if (!ALLOW_PATTERNS.some((re) => re.test(ctx))) {
          hits.push({ file, line: i + 1, col: m.index + 1, match: m[0], rule });
        }
        if (m[0].length === 0) rule.re.lastIndex++;
      }
    }
  });
  return hits;
}

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const files = collectTargets(argv.filter((a) => !a.startsWith('--')));
const hits = files.flatMap(scanFile);

let errors = 0;
let warns = 0;
for (const h of hits) {
  if (h.rule.severity === 'error') errors++;
  else warns++;
  const loc = `${relative(ROOT, h.file)}:${h.line}:${h.col}`;
  console.log(`[${h.rule.severity}] ${loc}  "${h.match}"  (${h.rule.id}: ${h.rule.note})`);
}

console.log(
  `\nlint:content  files=${files.length}  errors=${errors}  warnings=${warns}` +
    (strict ? '  (--strict)' : ''),
);
process.exit(errors > 0 || (strict && warns > 0) ? 1 : 0);
