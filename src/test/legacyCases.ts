import case03 from './fixtures/v1/case-01.json';
import case04 from './fixtures/v1/case-02.json';
import case05 from './fixtures/v1/case-03.json';
import case06 from './fixtures/v1/case-04.json';
import case07 from './fixtures/v1/case-05.json';
import type { CaseData } from '../domain/types';

/** Immutable V1 case snapshots preserve the original facts and answer keys during V2 migration. */
export const LEGACY_CASES = [case03, case04, case05, case06, case07].map((c, index) => ({
  ...c,
  id: `case-${String(index + 3).padStart(2, '0')}`,
})) as unknown as CaseData[];
