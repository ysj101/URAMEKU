import type { CaseData, CaseProgress, V2DecisionRecord } from './types';

/** A policy can fit a purpose without being the one uniquely correct policy. */
export function reviewDecisionRecord(
  caseData: CaseData,
  progress: CaseProgress,
  record: V2DecisionRecord,
): { recorded: boolean; grounded: boolean; affordable: boolean } {
  const definition = caseData.v2?.decision;
  if (!definition) return { recorded: false, grounded: false, affordable: false };
  const option = definition.options.find((candidate) => candidate.id === record.optionId);
  const recorded =
    definition.objectives.some((objective) => objective.id === record.objectiveId) &&
    Boolean(option) &&
    record.reason.trim().length > 0 &&
    record.assumptions.trim().length > 0;
  const sources = [...record.evidence, ...record.counterEvidence];
  const grounded =
    record.evidence.length > 0 &&
    record.counterEvidence.length > 0 &&
    new Set(sources).size === sources.length &&
    sources.every(
      (id) =>
        caseData.documents.some((document) => document.id === id) &&
        progress.opened.includes(id) &&
        progress.pinned.includes(id),
    );
  return {
    recorded,
    grounded,
    affordable: Boolean(option && option.cost >= 0 && option.cost <= definition.resources),
  };
}

export function decisionComparisonAvailable(caseData: CaseData, progress: CaseProgress): boolean {
  const definition = caseData.v2?.decision;
  return Boolean(
    definition &&
    progress.v2?.decisions.length &&
    definition.revealDocuments.every((id) => progress.opened.includes(id)),
  );
}

export function decisionComplete(caseData: CaseData, progress: CaseProgress): boolean {
  const definition = caseData.v2?.decision;
  const records = progress.v2?.decisions;
  if (!definition || !records?.length) return false;
  const minimumRecords = definition.revealDocuments.length ? 2 : 1;
  if (records.length < minimumRecords || !decisionComparisonAvailable(caseData, progress))
    return false;
  return records.every((record) => {
    const review = reviewDecisionRecord(caseData, progress, record);
    return review.recorded && review.grounded && review.affordable;
  });
}

/** Outcomes describe the authored scenario, not a score for a player's judgement. */
export function decisionOutcome(caseData: CaseData, progress: CaseProgress) {
  const definition = caseData.v2?.decision;
  const record = progress.v2?.decisions.at(-1);
  if (!definition || !record || !decisionComplete(caseData, progress)) return null;
  const option = definition.options.find((candidate) => candidate.id === record.optionId);
  if (!option) return null;
  return {
    option,
    objective: definition.objectives.find((objective) => objective.id === record.objectiveId),
    counterfactuals: definition.options.filter((candidate) => candidate.id !== record.optionId),
  };
}
