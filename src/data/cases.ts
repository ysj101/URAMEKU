import type { CaseData } from '../domain/types';

/**
 * data/cases/*.json を唯一の正本として読み込む。
 * スキーマによる厳密検証は MVP-006 で追加する。
 */
const modules = import.meta.glob('../../data/cases/*.json', { eager: true, import: 'default' });

export const CASES: CaseData[] = Object.keys(modules)
  .sort()
  .map((key) => modules[key] as CaseData);

export function findCase(id: string): CaseData | undefined {
  return CASES.find((c) => c.id === id);
}

export function caseIndex(id: string): number {
  return CASES.findIndex((c) => c.id === id);
}

export function nextCaseId(id: string): string | undefined {
  const i = caseIndex(id);
  if (i < 0) return CASES[0]?.id;
  return CASES[(i + 1) % CASES.length]?.id;
}
