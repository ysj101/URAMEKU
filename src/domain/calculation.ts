import type { AnalysisTask, CaseData, CaseProgress } from './types';

/**
 * 数値検証メモの解釈ルール（MVP-010）
 *
 * 許容する入力:
 * - 前後の空白（半角・全角）
 * - 全角数字・全角記号（１２３．５ / －５ / ＋５ / １，２００）
 * - 桁区切りカンマ（1,200 / 1,200,000）。位置の妥当性は検証せず単に除去する
 * - 末尾の `%`/`％` と、タスクの単位文字列（`AnalysisTask.unit`）。例: `45%`, `150万円`, `10ポイント`
 * - `+` 符号、先頭のゼロ（`045` → 45）、末尾の小数点（`45.` → 45）、先頭の小数点（`.5` → 0.5）
 *
 * 拒否する入力（value: null）:
 * - 空欄・空白のみ（issue: 'empty'）
 * - `NaN` / `Infinity` / 文字混じり / 複数の小数点 / 符号のみ / 数字の途中の空白（issue: 'not-a-number'）
 * - 指数表記（`1e3`）。回答欄は「資料から計算した数値」を書く場所であり、
 *   指数表記は入力ミスの可能性が高いので意図的に拒否する（issue: 'not-a-number'）
 *
 * 負値は「解釈はできるが不正解」として value を返し、issue: 'negative' を付ける。
 * （本リポジトリの全タスクの期待値は 0 以上。差分や増加率を符号付きで答えた場合などに UI が理由を表示できる）
 */

export type InputIssue = 'empty' | 'not-a-number' | 'negative';

export interface InterpretedInput {
  /** 数値として解釈できた値。解釈不能なら null */
  value: number | null;
  /** 正規化後の文字列（半角化・単位/区切り除去後）。デバッグや UI 表示用 */
  normalized: string;
  /** 解釈できなかった、または注意が必要な理由 */
  issue?: InputIssue;
}

const FULLWIDTH_MAP: Record<string, string> = {
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
  '．': '.',
  '，': ',',
  '－': '-',
  '−': '-', // U+2212 MINUS SIGN
  ー: '-', // 長音符をマイナスとして打った場合
  '＋': '+',
  '％': '%',
  '　': ' ',
};

/** 全角数字・記号を半角に寄せる */
export function toHalfWidth(raw: string): string {
  return Array.from(raw, (ch) => FULLWIDTH_MAP[ch] ?? ch).join('');
}

/** 半角化した文字列の末尾から `%` と単位を取り除く */
function stripUnit(s: string, unit: string | undefined): string {
  let out = s.trim();
  const candidates = ['%'];
  if (unit) {
    const u = toHalfWidth(unit).trim();
    if (u) candidates.unshift(u);
  }
  for (const suffix of candidates) {
    if (out.length > suffix.length && out.endsWith(suffix)) {
      out = out.slice(0, -suffix.length).trim();
      break;
    }
  }
  return out;
}

/** 厳密な10進数表記のみ許容する（指数表記・Infinity・NaN は不許容） */
const DECIMAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * 入力文字列を解釈し、値・正規化文字列・理由を返す。
 * `task` を渡すとその単位文字列を末尾から除去できる。
 */
export function interpretInput(
  raw: string | number | undefined | null,
  task?: Pick<AnalysisTask, 'unit'>,
): InterpretedInput {
  if (raw === undefined || raw === null) return { value: null, normalized: '', issue: 'empty' };
  const half = toHalfWidth(String(raw)).trim();
  if (half === '') return { value: null, normalized: '', issue: 'empty' };

  const noUnit = stripUnit(half, task?.unit);
  const normalized = noUnit.replace(/,/g, '');

  if (!DECIMAL_PATTERN.test(normalized)) {
    return { value: null, normalized, issue: 'not-a-number' };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { value: null, normalized, issue: 'not-a-number' };
  }
  // -0 は 0 として扱う
  if (value < 0) return { value, normalized, issue: 'negative' };
  return { value: value === 0 ? 0 : value, normalized };
}

/**
 * 入力文字列を数値として解釈する。空欄や解釈不能は null。
 * 負値は数値として返す（正誤判定は isWithinTolerance が行う）。
 */
export function parseNumericInput(
  raw: string | number | undefined | null,
  task?: Pick<AnalysisTask, 'unit'>,
): number | null {
  return interpretInput(raw, task).value;
}

/**
 * 許容誤差内か。
 * tolerance が 0 のタスクは完全一致。ただし `0.1 + 0.2` のような浮動小数の
 * 丸め誤差を吸収するため 1e-9 だけ余裕を持たせる。
 */
export function isWithinTolerance(value: number, task: AnalysisTask): boolean {
  return Math.abs(value - task.expected) <= task.tolerance + 1e-9;
}

export function isTaskCorrect(task: AnalysisTask, raw: string | undefined): boolean {
  const value = parseNumericInput(raw, task);
  return value !== null && isWithinTolerance(value, task);
}

export function setCalculation(progress: CaseProgress, taskId: string, raw: string): CaseProgress {
  return { ...progress, calculations: { ...progress.calculations, [taskId]: raw } };
}

/** 正解した検証メモの数 */
export function countCorrectCalculations(caseData: CaseData, progress: CaseProgress): number {
  return caseData.analysis_tasks.filter((t) => isTaskCorrect(t, progress.calculations[t.id]))
    .length;
}
