import type { CaseData, CaseProgress, V2DecodingTask } from './types';

export interface DecodingReview {
  taskId: string;
  recorded: boolean;
  grounded: boolean;
  factuallyConsistent: boolean;
  status?: 'supported' | 'contradicted' | 'uncertain';
  explanation?: string;
  evidence: string[];
}

/** A claim is checked against its documented facts, never against a player's personality. */
export function reviewDecodingTask(task: V2DecodingTask, progress: CaseProgress): DecodingReview {
  const record = progress.v2?.decoding[task.id];
  const option = task.options.find((candidate) => candidate.id === record?.optionId);
  if (!record || !option) {
    return {
      taskId: task.id,
      recorded: false,
      grounded: false,
      factuallyConsistent: false,
      evidence: [],
    };
  }
  // 根拠は手動で選ばせず、選んだ答えが参照する資料（JSON 定義）を
  // すべて開いて証拠ボードに採用していれば「根拠あり」と自動判定する。
  const grounded =
    option.evidence.length > 0 &&
    option.evidence.every((id) => progress.opened.includes(id) && progress.pinned.includes(id));
  return {
    taskId: task.id,
    recorded: true,
    grounded,
    factuallyConsistent: option.accepted,
    status: option.status,
    explanation: option.reason,
    evidence: option.evidence,
  };
}

export function decodingReviews(caseData: CaseData, progress: CaseProgress): DecodingReview[] {
  return caseData.v2?.decoding.map((task) => reviewDecodingTask(task, progress)) ?? [];
}

export function completedDecodingCount(caseData: CaseData, progress: CaseProgress): number {
  return decodingReviews(caseData, progress).filter(
    (review) => review.grounded && review.factuallyConsistent,
  ).length;
}
