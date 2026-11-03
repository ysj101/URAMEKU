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
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ROOT, listFiles, runWithBaseline, walkStrings } from './lib/lint_common.mjs';

const WARN_LEN = 60;
const ERROR_LEN = 100;

const TARGETS = [
  { dir: 'data/cases', ext: ['.json'] },
  { dir: 'data/tutorial', ext: ['.json'] },
  { dir: 'data/ui', ext: ['.json'] },
  { dir: 'src', ext: ['.tsx'] },
];
function readWordList(name) {
  const p = join(ROOT, '.yomiyasu-words', name);
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}
const FLAG_WORDS = readWordList('flag.txt');

function collectTargets(args) {
  if (args.length) return args.map((a) => resolve(ROOT, a));
  return TARGETS.flatMap(({ dir, ext }) => listFiles(join(ROOT, dir), ext));
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
const baselineKey = (h) => `${h.loc.replace(/:\d+$/, '')} | ${h.match} | ${h.text ?? ''}`;

const argv = process.argv.slice(2);
const files = collectTargets(argv.filter((a) => !a.startsWith('--')));
process.exit(
  runWithBaseline({
    name: 'lint:wording',
    baselinePath: join(ROOT, 'qa', 'wording-baseline.json'),
    argv,
    hits: files.flatMap((f) => (f.endsWith('.json') ? scanJson(f) : scanTsx(f))),
    keyOf: baselineKey,
    summary: `files=${files.length}  flagWords=${FLAG_WORDS.length}`,
    strict: argv.includes('--strict'),
  }),
);
