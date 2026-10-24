import { countFragmentsInPlace, isArticleCorrect } from './article';
import { remainingBudget } from './budget';
import { countCorrectCalculations } from './calculation';
import { isLinkCorrect } from './link';
import { publishVerdict, type PublishVerdict, type VerdictTrack } from './publish';
import { ARTICLE_LENGTH, type CaseData, type CaseProgress } from './types';

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

/** 配点表の系統（合否 4 系統 + 調査予算） */
export type ScoreTrack = VerdictTrack | 'budget';

export interface ScoreBreakdownRow {
  track: ScoreTrack;
  /** 画面表示用の系統名（正解の内容は含めない） */
  label: string;
  earned: number;
  max: number;
}

export const SCORE_TRACK_LABELS: Record<ScoreTrack, string> = {
  evidence: '必要な裏付け資料',
  link: '関係する 2 資料の照合',
  calculation: '数値検証メモ',
  article: '見出しの論理的な断片',
  budget: '未使用の調査予算',
};

/** 不足している系統とその説明（どの資料・どの答えかは名指ししない） */
export interface FailureReason {
  track: VerdictTrack;
  message: string;
}

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
  /** 系統ごとの得点と満点。earned の合計は points と一致する */
  breakdown: ScoreBreakdownRow[];
}

export function evaluateCase(caseData: CaseData, progress: CaseProgress): Evaluation {
  const requiredFound = caseData.required_evidence.filter((id) => progress.pinned.includes(id));
  const linkCorrect = isLinkCorrect(caseData, progress);
  const calculationsCorrect = countCorrectCalculations(caseData, progress);
  const fragmentsInPlace = countFragmentsInPlace(caseData, progress);
  const articleCorrect = isArticleCorrect(caseData, progress);
  const remaining = remainingBudget(caseData, progress);

  const breakdown: ScoreBreakdownRow[] = [
    {
      track: 'evidence',
      label: SCORE_TRACK_LABELS.evidence,
      earned: Math.min(
        SCORE_WEIGHTS.evidenceMax,
        requiredFound.length * SCORE_WEIGHTS.evidencePerItem,
      ),
      max: SCORE_WEIGHTS.evidenceMax,
    },
    {
      track: 'link',
      label: SCORE_TRACK_LABELS.link,
      earned: linkCorrect ? SCORE_WEIGHTS.link : 0,
      max: SCORE_WEIGHTS.link,
    },
    {
      track: 'calculation',
      label: SCORE_TRACK_LABELS.calculation,
      earned: Math.min(
        SCORE_WEIGHTS.calculationMax,
        calculationsCorrect * SCORE_WEIGHTS.calculationPerItem,
      ),
      max: SCORE_WEIGHTS.calculationMax,
    },
    {
      track: 'article',
      label: SCORE_TRACK_LABELS.article,
      earned: Math.min(SCORE_WEIGHTS.fragmentMax, fragmentsInPlace * SCORE_WEIGHTS.fragmentPerItem),
      max: SCORE_WEIGHTS.fragmentMax,
    },
    {
      track: 'budget',
      label: SCORE_TRACK_LABELS.budget,
      earned: Math.min(
        SCORE_WEIGHTS.budgetMax,
        Math.max(0, remaining) * SCORE_WEIGHTS.budgetPerPoint,
      ),
      max: SCORE_WEIGHTS.budgetMax,
    },
  ];
  const points = breakdown.reduce((sum, row) => sum + row.earned, 0);

  // 合否は publish.ts の一元判定に委譲する（点数計算とは独立）
  const cleared = publishVerdict(caseData, progress).approved;

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
    breakdown,
  };
}

/**
 * 差し戻し理由。`publishVerdict().missing` に挙がった系統だけを列挙する。
 * メッセージは不足の「種別と数」のみを伝え、どの資料・どの答えが正解かは示さない
 * （正解は「解説と正解を公開する」の明示操作でのみ開示する）。
 */
export function failureReasons(caseData: CaseData, progress: CaseProgress): FailureReason[] {
  const verdict = publishVerdict(caseData, progress);
  return verdict.missing.map((track) => ({
    track,
    message: reasonMessage(track, verdict.detail, progress),
  }));
}

function reasonMessage(
  track: VerdictTrack,
  detail: PublishVerdict['detail'],
  progress: CaseProgress,
): string {
  switch (track) {
    case 'evidence':
      return `必要な裏付け資料が ${detail.evidence.total - detail.evidence.done} 件足りません`;
    case 'link':
      return '2 資料の照合が成立していません';
    case 'calculation':
      return `数値検証メモに未入力または誤りが ${detail.calculation.total - detail.calculation.done} 問あります`;
    case 'article':
      return progress.article.length < ARTICLE_LENGTH
        ? `見出しの断片が ${ARTICLE_LENGTH} つ揃っていません`
        : '見出しの断片の選択か順序に誤りがあります';
  }
}
