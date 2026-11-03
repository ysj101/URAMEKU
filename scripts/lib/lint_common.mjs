/**
 * scripts/lint_*.mjs の共通部品。
 *  - listFiles: 対象ファイルの列挙（node_modules / dist / archive と *.test.* を除く）
 *  - walkStrings: JSON の文字列を (パス, 値) で列挙
 *  - runWithBaseline: 控え（baseline）付きの実行。--no-baseline / --update-baseline を解釈し、
 *    指摘を表示して終了コードを返す
 *
 * 控えは、仕組みを入れる前から残っている指摘を一時的に見逃すためのもの。
 * 控えにない新しい指摘だけが失敗になる。控えは減らす方向にだけ更新し、新しい指摘を控えに足さない。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'archive']);
const SKIP_FILE = /\.test\.tsx?$/;

export function listFiles(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(p, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e)) && !SKIP_FILE.test(entry.name)) out.push(p);
  }
  return out;
}

/** JSON の文字列を (パス, 値) で列挙する。パスは `a.b[0].c` の形 */
export function* walkStrings(value, path = '') {
  if (typeof value === 'string') yield { path, value };
  else if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* walkStrings(v, `${path}[${i}]`);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, path ? `${path}.${k}` : k);
}

/**
 * 控え付きで指摘を処理する。
 * @param {object} o
 * @param {string} o.name        ログの接頭辞（例: 'lint:ui'）
 * @param {string} o.baselinePath 控えファイルの絶対パス
 * @param {string[]} o.argv      コマンドライン引数
 * @param {object[]} o.hits      全指摘。{ severity?, loc, match, note } を持つ
 * @param {(hit) => string} o.keyOf 控えの鍵。行番号など変わりやすいものは入れない
 * @param {(hit) => string} [o.format] 1 行の表示
 * @param {string} [o.summary]   末尾に足す集計文字列
 * @param {boolean} [o.strict]   warn も失敗扱いにする
 * @returns {number} 終了コード
 */
export function runWithBaseline({
  name,
  baselinePath,
  argv,
  hits: allHits,
  keyOf,
  format,
  summary,
  strict,
}) {
  if (argv.includes('--update-baseline')) {
    const entries = [...new Set(allHits.map(keyOf))].sort();
    writeFileSync(
      baselinePath,
      JSON.stringify(
        {
          note: `${name} が仕組み導入前の指摘を一時的に見逃すための控え。減らす方向にだけ更新する（--update-baseline）。`,
          entries,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      `${name}  baseline updated: ${entries.length} entries -> ${relative(ROOT, baselinePath)}`,
    );
    return 0;
  }

  const baseline =
    argv.includes('--no-baseline') || !existsSync(baselinePath)
      ? new Set()
      : new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).entries ?? []);
  const hits = allHits.filter((h) => !baseline.has(keyOf(h)));
  const suppressed = allHits.length - hits.length;

  let errors = 0;
  let warns = 0;
  for (const h of hits) {
    if (h.severity === 'warn') warns++;
    else errors++;
    console.log(
      format ? format(h) : `[${h.severity ?? 'error'}] ${h.loc}  "${h.match}"  (${h.note})`,
    );
  }
  console.log(
    `\n${name}  ${summary ?? ''}  errors=${errors}  warnings=${warns}  baseline=${suppressed}` +
      (strict ? '  (--strict)' : ''),
  );
  return errors > 0 || (strict && warns > 0) ? 1 : 0;
}
