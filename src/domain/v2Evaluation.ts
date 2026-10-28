import { decodingReviews } from './decoding';
import { decisionComplete, decisionComparisonAvailable, reviewDecisionRecord } from './decision';
import { experimentComplete } from './experiment';
import { v2GraphProgress } from './link';
import type { CaseData, CaseProgress, V2DecisionRecord } from './types';

export type V2Track = 'decoding' | 'graph' | 'experiment' | 'decision' | 'report';
export interface V2TrackProgress {
  done: number;
  total: number;
}
export interface V2FactualError {
  taskId: string;
  message: string;
  evidence: string[];
}
export interface V2Evaluation {
  completed: boolean;
  tracks: Record<V2Track, V2TrackProgress>;
  factualErrors: V2FactualError[];
  missing: string[];
  uncertainties: string[];
  decisionHistory: V2DecisionRecord[];
}

export const V2_TRACK_LABELS: Record<V2Track, string> = {
  decoding: '情報解読と根拠',
  graph: '資料の関係',
  experiment: '提示条件の比較',
  decision: '目的・前提・判断の記録',
  report: '自由文の補足（任意）',
};

/** Completion measures documented work, never a value judgement, a reaction or outcome luck. */
export function evaluateV2Case(caseData: CaseData, progress: CaseProgress): V2Evaluation {
  const definition = caseData.schemaVersion === 2 ? caseData.v2 : undefined;
  const reviews = decodingReviews(caseData, progress);
  const experiment = progress.v2?.experiment;
  const decisionRecords = progress.v2?.decisions ?? [];
  const firstDecision = decisionRecords[0];
  const firstReview = firstDecision
    ? reviewDecisionRecord(caseData, progress, firstDecision)
    : undefined;
  const decisionTotal = definition?.decision
    ? definition.decision.revealDocuments.length
      ? 2
      : 1
    : 0;
  const initialExperiment = Boolean(
    experiment?.initialChoice &&
    definition?.experiment?.choices.some((choice) => choice.id === experiment.initialChoice),
  );
  const comparedExperiment =
    initialExperiment &&
    Boolean(definition?.experiment?.revealDocuments.every((id) => progress.opened.includes(id)));
  const tracks: V2Evaluation['tracks'] = {
    decoding: {
      done: reviews.filter((review) => review.grounded && review.factuallyConsistent).length,
      total: definition?.decoding.length ?? 0,
    },
    graph: definition ? v2GraphProgress(caseData, progress) : { done: 0, total: 1 },
    experiment: {
      done: definition?.experiment
        ? Number(initialExperiment) +
          Number(comparedExperiment) +
          Number(experimentComplete(caseData, progress))
        : 0,
      total: definition?.experiment ? 3 : 0,
    },
    decision: {
      done: definition?.decision
        ? decisionComplete(caseData, progress)
          ? decisionTotal
          : Math.min(
              decisionTotal - 1,
              Number(
                Boolean(
                  firstReview?.recorded && firstReview.affordable && firstDecision?.evidence.length,
                ),
              ),
            )
        : 0,
      total: decisionTotal,
    },
    // 自由文の補足は任意。書いた分だけ done に数え、完了の条件（total）にはしない。
    report: {
      done:
        Number(Boolean(progress.v2?.report.claim.trim())) +
        Number(Boolean(progress.v2?.report.uncertainty.trim())),
      total: 0,
    },
  };
  const factualErrors = reviews
    .filter((review) => review.recorded && !review.factuallyConsistent)
    .map((review) => ({
      taskId: review.taskId,
      message: review.explanation ?? '資料と整合しない事実の読み取りがあります。',
      evidence: review.evidence,
    }));
  const missing = (Object.keys(tracks) as V2Track[])
    .filter((track) => tracks[track].done < tracks[track].total)
    .map((track) => `${V2_TRACK_LABELS[track]}に未記録・未確認・根拠不足の項目があります。`);
  if (
    definition?.decision &&
    decisionRecords.length > 0 &&
    !decisionComparisonAvailable(caseData, progress) &&
    !missing.some((message) => message.startsWith(V2_TRACK_LABELS.decision))
  )
    missing.push('追加情報を確認して判断を維持・更新する段階が残っています。');
  const uncertainties = [
    ...reviews
      .filter((review) => review.status === 'uncertain' && review.factuallyConsistent)
      .map(
        (review) =>
          definition?.decoding
            .find((task) => task.id === review.taskId)
            ?.options.find((option) => option.id === progress.v2?.decoding[review.taskId]?.optionId)
            ?.text ?? '未確認の情報が残っています。',
      ),
    ...(progress.v2?.report.uncertainty.trim() ? [progress.v2.report.uncertainty] : []),
    ...(decisionRecords.at(-1)?.assumptions.trim() ? [decisionRecords.at(-1)!.assumptions] : []),
  ];
  return {
    completed: Boolean(
      definition && progress.v2 && missing.length === 0 && factualErrors.length === 0,
    ),
    tracks,
    factualErrors,
    missing,
    uncertainties: [...new Set(uncertainties)],
    decisionHistory: decisionRecords,
  };
}
