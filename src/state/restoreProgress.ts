import { normalizeProgress } from '../domain/game';
import { isDocumentSealed } from '../domain/budget';
import { createV2Progress } from '../domain/v2Progress';
import type { CaseData, CaseProgress } from '../domain/types';

/** Restore only references belonging to this revision; malformed phases never unlock hidden data. */
export function restoreProgress(caseData: CaseData, raw: CaseProgress): CaseProgress {
  const progress = normalizeProgress(raw);
  const ids = new Set(caseData.documents.map((d) => d.id));
  progress.opened = [...new Set(progress.opened)].filter((id) => ids.has(id));
  progress.pinned = [...new Set(progress.pinned)].filter((id) => progress.opened.includes(id));
  if (!caseData.v2) return progress;
  const config = caseData.v2;
  const v2 = progress.v2 ?? createV2Progress(caseData);
  const base = createV2Progress(caseData);
  if (config.experiment) {
    const e = v2.experiment;
    const initial =
      e?.initialChoice && config.experiment.choices.some((c) => c.id === e.initialChoice)
        ? e.initialChoice
        : null;
    const updated =
      initial && e?.updatedChoice && config.experiment.choices.some((c) => c.id === e.updatedChoice)
        ? e.updatedChoice
        : null;
    const complete = !!(
      updated &&
      e?.reason.trim() &&
      config.experiment.revealDocuments.every((id) => progress.opened.includes(id))
    );
    v2.experiment = {
      conditionId: base.experiment!.conditionId,
      initialChoice: initial,
      updatedChoice: complete ? updated : null,
      stage: complete ? 'complete' : initial ? 'comparison' : 'initial',
      reason: complete ? e!.reason : '',
    };
  } else delete v2.experiment;
  const validEvidence = (evidence: string[]) =>
    evidence.every((id) => progress.pinned.includes(id));
  const knownHistory = (evidence: string[]) =>
    evidence.every((id) => ids.has(id) && progress.opened.includes(id));
  v2.decisions = config.decision
    ? v2.decisions.filter(
        (r) =>
          config.decision!.objectives.some((o) => o.id === r.objectiveId) &&
          config.decision!.options.some(
            (o) => o.id === r.optionId && o.cost <= config.decision!.resources,
          ) &&
          r.evidence.length > 0 &&
          knownHistory(r.evidence) &&
          knownHistory(r.counterEvidence) &&
          r.reason.trim() &&
          r.assumptions.trim(),
      )
    : [];
  if (
    config.decision &&
    !config.decision.revealDocuments.every((id) => progress.opened.includes(id))
  )
    v2.decisions = v2.decisions.slice(0, 1);
  progress.v2 = v2;
  progress.opened = progress.opened.filter((id) => !isDocumentSealed(caseData, progress, id));
  progress.pinned = progress.pinned.filter((id) => progress.opened.includes(id));
  v2.links = v2.links.filter((link) => validEvidence([link.from, link.to]));
  for (const [id, response] of Object.entries(v2.decoding)) {
    if (
      !config.decoding.some(
        (task) => task.id === id && task.options.some((o) => o.id === response.optionId),
      ) ||
      !validEvidence(response.evidence)
    )
      delete v2.decoding[id];
  }
  return progress;
}
