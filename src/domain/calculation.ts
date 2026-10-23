import type { AnalysisTask, CaseData, CaseProgress } from './types';

/** 入力文字列を数値として解釈する。空欄や解釈不能は null。 */
export function parseNumericInput(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** 許容誤差内か */
export function isWithinTolerance(value: number, task: AnalysisTask): boolean {
  return Math.abs(value - task.expected) <= task.tolerance + 1e-9;
}

export function isTaskCorrect(task: AnalysisTask, raw: string | undefined): boolean {
  const value = parseNumericInput(raw);
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
