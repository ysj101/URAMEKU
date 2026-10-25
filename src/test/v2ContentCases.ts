import case01 from '../../data/cases-v2/case-01.json';
import type { CaseData } from '../domain/types';
import { validateCase } from '../data/validateCase';

/** Staged V2 content. The production loader switches atomically in V2-012. */
export const V2_CONTENT_CASES: CaseData[] = [case01].map((raw) => {
  const result = validateCase(raw);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return raw as unknown as CaseData;
});
