import type { CaseData } from '../domain/types';
import { difficultyLevel } from '../domain/caseStatus';
import { assertCase } from './validateCase';

/**
 * data/cases/*.json を唯一の正本として読み込む。
 * 各 JSON は読み込み時に validateCase で検証し、不正なら起動時に例外で止める（開発時に即座に気づけるようにする）。
 */
const modules = import.meta.glob('../../data/cases/*.json', { eager: true, import: 'default' });

/**
 * 一覧の並び順。難易度の低い順（標準 → 難関 → 最難関）、同じ難易度なら ID 順。
 * 画面の「CASE 01」はこの並びの位置で決まるので、標準の事件が先頭に来る。
 * 事件 ID（保存データ・図鑑・攻略資料のキー）は並び順に依存しない。
 */
export function sortCases<T extends Pick<CaseData, 'id' | 'difficulty'>>(cases: readonly T[]): T[] {
  return [...cases].sort(
    (a, b) => difficultyLevel(a.difficulty) - difficultyLevel(b.difficulty) || a.id.localeCompare(b.id),
  );
}

export const CASES: CaseData[] = sortCases(
  Object.keys(modules)
    .sort()
    .map((key) => assertCase(modules[key], key)),
);

export function findCase(id: string): CaseData | undefined {
  return CASES.find((c) => c.id === id);
}

export function caseIndex(id: string): number {
  return CASES.findIndex((c) => c.id === id);
}

/** 一覧の位置から決まる表示用の番号（1 始まり）。一覧に無い ID なら null */
export function caseNumber(id: string): number | null {
  const i = caseIndex(id);
  return i < 0 ? null : i + 1;
}

export function nextCaseId(id: string): string | undefined {
  const i = caseIndex(id);
  if (i < 0) return CASES[0]?.id;
  return CASES[(i + 1) % CASES.length]?.id;
}
