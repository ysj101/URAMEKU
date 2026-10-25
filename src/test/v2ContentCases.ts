import case01 from '../../data/cases-v2/case-01.json';
import case02 from '../../data/cases-v2/case-02.json';
import case03 from '../../data/cases-v2/case-03.json';
import case04 from '../../data/cases-v2/case-04.json';
import case05 from '../../data/cases-v2/case-05.json';
import type { CaseData } from '../domain/types';
import { validateCase } from '../data/validateCase';

/** Staged V2 content. The production loader switches atomically in V2-012. */
export const V2_CONTENT_CASES: CaseData[] = [case01, case02, case03, case04, case05].map((raw) => {
  const result = validateCase(raw);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return raw as unknown as CaseData;
});
