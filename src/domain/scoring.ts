import { countFragmentsInPlace, isArticleCorrect } from './article';
import { remainingBudget } from './budget';
import { countCorrectCalculations } from './calculation';
import { isLinkCorrect } from './link';
import type { CaseData, CaseProgress } from './types';

/** docs/GAME_RULES.md 7 章の配点 */
export const SCORE_WEIGHTS = {
  evidencePerItem: 8,
  evidenceMax: 24,
  link: 20,
  calculationPerItem: 13,
  calculationMax: 26,
  fragmentPerItem: 8,
  fragmentMax: 24,
  budgetPerPoint: 2,
  budgetMax: 6,
} as const;

export interface Evaluation {
  /** 採用済みの必要証拠 ID */
  requiredFound: string[];
  requiredTotal: number;
  linkCorrect: boolean;
  calculationsCorrect: number;
  calculationsTotal: number;
  fragmentsInPlace: number;
  articleCorrect: boolean;
  remainingBudget: number;
  points: number;
  cleared: boolean;
}

export function evaluateCase(caseData: CaseData, progress: CaseProgress): Evaluation {
  const requiredFound = caseData.required_evidence.filter((id) => progress.pinned.includes(id));
  const linkCorrect = isLinkCorrect(caseData, progress);
  const calculationsCorrect = countCorrectCalculations(caseData, progress);
  const fragmentsInPlace = countFragmentsInPlace(caseData, progress);
  const articleCorrect = isArticleCorrect(caseData, progress);
  const remaining = remainingBudget(caseData, progress);

  const points =
    Math.min(SCORE_WEIGHTS.evidenceMax, requiredFound.length * SCORE_WEIGHTS.evidencePerItem) +
    (linkCorrect ? SCORE_WEIGHTS.link : 0) +
    Math.min(SCORE_WEIGHTS.calculationMax, calculationsCorrect * SCORE_WEIGHTS.calculationPerItem) +
    Math.min(SCORE_WEIGHTS.fragmentMax, fragmentsInPlace * SCORE_WEIGHTS.fragmentPerItem) +
    Math.min(SCORE_WEIGHTS.budgetMax, Math.max(0, remaining) * SCORE_WEIGHTS.budgetPerPoint);

  const cleared =
    requiredFound.length === caseData.required_evidence.length &&
    linkCorrect &&
    calculationsCorrect === caseData.analysis_tasks.length &&
    articleCorrect;

  return {
    requiredFound,
    requiredTotal: caseData.required_evidence.length,
    linkCorrect,
    calculationsCorrect,
    calculationsTotal: caseData.analysis_tasks.length,
    fragmentsInPlace,
    articleCorrect,
    remainingBudget: remaining,
    points,
    cleared,
  };
}
