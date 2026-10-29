import type { CaseData, CaseProgress, V2BoardRecord, V2BoardTask } from './types';

export const BOARD_DISPOSITIONS = {
  keep: 'そのまま残す',
  revise: '内容を直す',
  hold: 'まだ判断できない',
} as const;

/** Shape and provenance, independent of the authored answer. Wrong interpretations remain editable. */
export function validBoardRecord(
  caseData: CaseData,
  progress: CaseProgress,
  task: V2BoardTask,
  record: V2BoardRecord,
): boolean {
  const board = caseData.v2?.board;
  if (!board || !record || !record.values || !Array.isArray(record.evidence)) return false;
  return (
    Object.hasOwn(BOARD_DISPOSITIONS, record.disposition) &&
    Object.keys(record.values).length === task.fields.length &&
    task.fields.every((field) =>
      field.options.some((option) => option.id === record.values[field.id]),
    ) &&
    record.evidence.length > 0 &&
    new Set(record.evidence).size === record.evidence.length &&
    record.evidence.every((id) => {
      const excerpt = board.excerpts.find((entry) => entry.id === id);
      const document = caseData.documents.find((entry) => entry.id === excerpt?.documentId);
      return Boolean(
        excerpt &&
        document?.content.includes(excerpt.quote) &&
        progress.opened.includes(document.id),
      );
    })
  );
}

export function boardReviews(caseData: CaseData, progress: CaseProgress) {
  return (caseData.v2?.board?.tasks ?? []).map((task) => {
    const record = progress.v2?.board?.[task.id];
    const recorded = Boolean(record && validBoardRecord(caseData, progress, task, record));
    const compatible = task.rules.filter(
      (rule) =>
        recorded &&
        record &&
        rule.disposition === record.disposition &&
        task.fields.every((field) => rule.values[field.id] === record.values[field.id]),
    );
    const allowed = new Set(compatible.flatMap((rule) => rule.evidence));
    const matching = compatible.find(
      (rule) =>
        record &&
        rule.evidence.every((id) => record.evidence.includes(id)) &&
        record.evidence.every((id) => allowed.has(id)),
    );
    return {
      task,
      record,
      recorded,
      accepted: Boolean(matching),
      explanation: matching?.explanation ?? task.explanation,
    };
  });
}

export function boardStatement(task: V2BoardTask, values?: Record<string, string>): string {
  return task.parts
    .map((part) => {
      if ('text' in part) return part.text;
      const field = task.fields.find((entry) => entry.id === part.field);
      return (
        field?.options.find((option) => option.id === (values?.[part.field] ?? field.original))
          ?.text ?? ''
      );
    })
    .join('');
}

/** All accepted source combinations, preserving alternatives across tasks. */
export function boardDocumentSets(caseData: CaseData): string[][] {
  const board = caseData.v2?.board;
  if (!board) return [];
  return board.tasks.reduce<string[][]>(
    (sets, task) => {
      const next = sets.flatMap((set) =>
        task.rules.map((rule) => [
          ...new Set([
            ...set,
            ...rule.evidence.map(
              (id) => board.excerpts.find((entry) => entry.id === id)!.documentId,
            ),
          ]),
        ]),
      );
      const minimal: string[][] = [];
      for (const candidate of next.sort((a, b) => a.length - b.length)) {
        if (!minimal.some((existing) => existing.every((id) => candidate.includes(id))))
          minimal.push(candidate);
      }
      return minimal;
    },
    [[]],
  );
}
