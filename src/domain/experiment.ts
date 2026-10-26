import { createV2Progress } from './v2Progress';
import type { CaseData, CaseProgress, V2Experiment } from './types';

export function experimentCondition(
  experiment: V2Experiment,
  progress: CaseProgress,
  fallbackConditionId?: string,
) {
  const assigned = progress.v2?.experiment?.conditionId ?? fallbackConditionId;
  return (
    experiment.conditions.find((condition) => condition.id === assigned) ?? experiment.conditions[0]
  );
}

export function comparisonAvailable(caseData: CaseData, progress: CaseProgress): boolean {
  const definition = caseData.v2?.experiment;
  const experiment = progress.v2?.experiment;
  return Boolean(
    definition &&
    experiment?.initialChoice &&
    definition.revealDocuments.every((id) => progress.opened.includes(id)),
  );
}

export function experimentComplete(caseData: CaseData, progress: CaseProgress): boolean {
  const definition = caseData.v2?.experiment;
  const experiment = progress.v2?.experiment;
  if (!definition || !experiment) return false;
  return (
    experiment.stage === 'complete' &&
    definition.conditions.some((condition) => condition.id === experiment.conditionId) &&
    definition.choices.some((choice) => choice.id === experiment.initialChoice) &&
    definition.choices.some((choice) => choice.id === experiment.updatedChoice) &&
    experiment.reason.trim().length > 0 &&
    comparisonAvailable(caseData, progress)
  );
}

/** Recorded reactions are descriptive. There is intentionally no correct-response field. */
export function experimentComparison(caseData: CaseData, progress: CaseProgress) {
  const definition = caseData.v2?.experiment;
  const experiment = progress.v2?.experiment;
  if (!definition || !experiment) return null;
  const text = (id: string | null) => definition.choices.find((choice) => choice.id === id)?.text;
  return {
    condition: experimentCondition(
      definition,
      progress,
      createV2Progress(caseData).experiment?.conditionId,
    ),
    initial: text(experiment.initialChoice),
    updated: text(experiment.updatedChoice),
    changed:
      experiment.updatedChoice !== null && experiment.initialChoice !== experiment.updatedChoice,
    reason: experiment.reason,
  };
}
