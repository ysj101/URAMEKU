import type { CaseData } from './types';
import { boardDocumentSets } from './board';

function uniqueMinimalSets(sets: string[][]): string[][] {
  const result: string[][] = [];
  for (const candidate of sets
    .map((ids) => [...new Set(ids)])
    .sort((a, b) => a.length - b.length)) {
    if (!result.some((existing) => existing.every((id) => candidate.includes(id))))
      result.push(candidate);
  }
  return result;
}

/** Minimal document unions for any authored valid route, rather than one fixed answer path. */
export function v2RequiredDocumentSets(caseData: CaseData): string[][] {
  const definition = caseData.v2;
  if (!definition) return [];
  let sets = definition.board
    ? boardDocumentSets(caseData)
    : definition.graph.paths.map((path) => path.flatMap((link) => [link.from, link.to]));
  for (const task of definition.decoding) {
    const alternatives = task.options
      .filter((option) => option.accepted)
      .map((option) => option.evidence);
    sets = uniqueMinimalSets(
      sets.flatMap((existing) => alternatives.map((evidence) => [...existing, ...evidence])),
    );
  }
  const revealed = [
    ...(definition.experiment?.revealDocuments ?? []),
    ...(definition.decision?.revealDocuments ?? []),
  ];
  return uniqueMinimalSets(sets.map((ids) => [...ids, ...revealed]));
}
