import type { CaseData } from '../domain/types';
import { assertCase } from './validateCase';

/**
 * data/cases/*.json を唯一の正本として読み込む。
 * 各 JSON は読み込み時に validateCase で検証し、不正なら起動時に例外で止める（開発時に即座に気づけるようにする）。
 */
const modules = import.meta.glob('../../data/cases/*.json', { eager: true, import: 'default' });

/**
 * 一覧は事件ID順。画面番号・JSON・素材・攻略資料が同じ事件を指す。
 * 難易度が変わっても事件の番号は変えない。
 */
export function sortCases<T extends Pick<CaseData, 'id' | 'difficulty'>>(cases: readonly T[]): T[] {
  return [...cases].sort((a, b) => a.id.localeCompare(b.id));
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

/** 事件IDの数字をそのまま表示する。一覧に無い ID なら null */
export function caseNumber(id: string): number | null {
  return findCase(id) ? Number(id.slice('case-'.length)) : null;
}

export function nextCaseId(id: string): string | undefined {
  const i = caseIndex(id);
  if (i < 0) return CASES[0]?.id;
  return CASES[(i + 1) % CASES.length]?.id;
}
