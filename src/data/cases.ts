import type { CaseData } from '../domain/types';
import { assertCase } from './validateCase';

/**
 * data/cases/*.json を唯一の正本として読み込む。
 * 各 JSON は読み込み時に validateCase で検証し、不正なら起動時に例外で止める（開発時に即座に気づけるようにする）。
 */
const modules = import.meta.glob('../../data/cases/*.json', { eager: true, import: 'default' });

export const CASES: CaseData[] = Object.keys(modules)
  .sort()
  .map((key) => assertCase(modules[key], key));

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
