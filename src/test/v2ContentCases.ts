import case01 from '../../data/cases/case-01.json';
import case02 from '../../data/cases/case-02.json';
import case03 from '../../data/cases/case-03.json';
import case04 from '../../data/cases/case-04.json';
import case05 from '../../data/cases/case-05.json';
import type { CaseData } from '../domain/types';
import { validateCase } from '../data/validateCase';

/** Canonical V2 content, shared by runtime and the complete walkthrough tests. */
export const V2_CONTENT_CASES: CaseData[] = [case01, case02, case03, case04, case05].map((raw) => {
  const result = validateCase(raw);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return raw as unknown as CaseData;
});
