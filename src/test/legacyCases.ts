import case01 from './fixtures/v1/case-01.json';
import case02 from './fixtures/v1/case-02.json';
import case03 from './fixtures/v1/case-03.json';
import case04 from './fixtures/v1/case-04.json';
import case05 from './fixtures/v1/case-05.json';
import type { CaseData } from '../domain/types';

/** Immutable V1 case snapshots preserve the original facts and answer keys during V2 migration. */
export const LEGACY_CASES = [case01, case02, case03, case04, case05] as unknown as CaseData[];
