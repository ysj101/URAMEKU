import type { CaseData, CaseProgress, V2Action, V2EvidenceLink, V2Progress } from './types';

export function createV2Progress(caseData: CaseData): V2Progress {
  const experiment = caseData.v2?.experiment;
  // Stable assignment, no external randomness and no reroll on reload/retry.
  const hash = [...caseData.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  const condition = experiment?.conditions[hash % experiment.conditions.length];
  return {
    decoding: {},
    links: [],
    decisions: [],
    report: { claim: '', uncertainty: '' },
    history: [],
    ...(condition
      ? {
          experiment: {
            conditionId: condition.id,
            initialChoice: null,
            updatedChoice: null,
            reason: '',
            stage: 'initial' as const,
          },
        }
      : {}),
  };
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): string => (typeof value === 'string' ? value.slice(0, 5000) : '');
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((x): x is string => typeof x === 'string'))].slice(0, 100)
    : [];
const relations = ['supports', 'contradicts', 'qualifies', 'sequence'];

/** Shape-only normalization. Case-specific IDs are checked by reducers and restoration. */
export function normalizeV2Progress(raw: unknown): V2Progress | undefined {
  if (!object(raw)) return undefined;
  const decoding: V2Progress['decoding'] = {};
  if (object(raw.decoding))
    for (const [id, item] of Object.entries(raw.decoding).slice(0, 100)) {
      if (
        object(item) &&
        typeof item.optionId === 'string' &&
        !['__proto__', 'constructor', 'prototype'].includes(id)
      ) {
        decoding[id] = {
          optionId: item.optionId,
          evidence: strings(item.evidence),
          ...(typeof item.note === 'string' ? { note: string(item.note) } : {}),
        };
      }
    }
  const links: V2EvidenceLink[] = [];
  if (Array.isArray(raw.links))
    for (const link of raw.links.slice(0, 100)) {
      if (
        object(link) &&
        typeof link.from === 'string' &&
        typeof link.to === 'string' &&
        relations.includes(String(link.relation)) &&
        link.from !== link.to
      ) {
        const edge = {
          from: link.from,
          to: link.to,
          relation: link.relation as V2EvidenceLink['relation'],
        };
        if (!links.some((x) => sameLink(x, edge))) links.push(edge);
      }
    }
  const decisions: V2Progress['decisions'] = [];
  if (Array.isArray(raw.decisions))
    for (const record of raw.decisions.slice(0, 100)) {
      if (
        object(record) &&
        typeof record.objectiveId === 'string' &&
        typeof record.optionId === 'string'
      )
        decisions.push({
          objectiveId: record.objectiveId,
          optionId: record.optionId,
          reason: string(record.reason),
          evidence: strings(record.evidence),
          counterEvidence: strings(record.counterEvidence),
          assumptions: string(record.assumptions),
        });
    }
  const history: V2Progress['history'] = [];
  if (Array.isArray(raw.history))
    for (const event of raw.history.slice(0, 500)) {
      if (object(event) && typeof event.type === 'string' && typeof event.targetId === 'string')
        history.push({ sequence: history.length + 1, type: event.type, targetId: event.targetId });
    }
  const report = object(raw.report)
    ? { claim: string(raw.report.claim), uncertainty: string(raw.report.uncertainty) }
    : { claim: '', uncertainty: '' };
  let experiment: V2Progress['experiment'];
  if (object(raw.experiment) && typeof raw.experiment.conditionId === 'string') {
    const e = raw.experiment;
    const initialChoice = typeof e.initialChoice === 'string' ? e.initialChoice : null;
    const updatedChoice =
      initialChoice && typeof e.updatedChoice === 'string' ? e.updatedChoice : null;
    // Impossible phase combinations are reduced to the last coherent phase.
    const stage =
      updatedChoice && e.stage === 'complete'
        ? 'complete'
        : initialChoice
          ? 'comparison'
          : 'initial';
    experiment = {
      conditionId: e.conditionId as string,
      initialChoice,
      updatedChoice: stage === 'complete' ? updatedChoice : null,
      reason: string(e.reason),
      stage,
    };
  }
  return { decoding, links, decisions, report, history, ...(experiment ? { experiment } : {}) };
}

export function sameLink(a: V2EvidenceLink, b: V2EvidenceLink): boolean {
  return a.from === b.from && a.to === b.to && a.relation === b.relation;
}

export function reduceV2Progress(
  caseData: CaseData,
  progress: CaseProgress,
  action: V2Action,
): CaseProgress {
  if (progress.published) return progress;
  const config = caseData.v2;
  if (caseData.schemaVersion !== 2 || !config) return progress;
  const v2 = progress.v2 ?? createV2Progress(caseData);
  const validEvidence = (ids: string[]) =>
    Array.isArray(ids) &&
    ids.every(
      (id) =>
        caseData.documents.some((d) => d.id === id) &&
        progress.opened.includes(id) &&
        progress.pinned.includes(id),
    ) &&
    new Set(ids).size === ids.length;
  const compared = (ids: string[]) => ids.every((id) => progress.opened.includes(id));
  const commit = (next: V2Progress, targetId: string) => ({
    ...progress,
    published: false,
    v2: {
      ...next,
      history: [
        ...next.history,
        { sequence: (next.history.at(-1)?.sequence ?? 0) + 1, type: action.type, targetId },
      ].slice(-500),
    },
  });
  switch (action.type) {
    case 'v2-decode': {
      const task = config.decoding.find((t) => t.id === action.taskId);
      if (!task?.options.some((o) => o.id === action.optionId) || !validEvidence(action.evidence))
        return progress;
      const response = {
        optionId: action.optionId,
        evidence: [...action.evidence],
        ...(action.note === undefined ? {} : { note: action.note.slice(0, 5000) }),
      };
      if (JSON.stringify(v2.decoding[action.taskId]) === JSON.stringify(response)) return progress;
      return commit(
        { ...v2, decoding: { ...v2.decoding, [action.taskId]: response } },
        action.taskId,
      );
    }
    case 'v2-link': {
      const link = action.link;
      if (
        !link ||
        link.from === link.to ||
        !relations.includes(link.relation) ||
        !validEvidence([link.from, link.to])
      )
        return progress;
      const exists = v2.links.some((x) => sameLink(x, link));
      if (!exists && v2.links.length >= 100) return progress;
      return commit(
        {
          ...v2,
          links: exists ? v2.links.filter((x) => !sameLink(x, link)) : [...v2.links, { ...link }],
        },
        `${link.from}:${link.to}`,
      );
    }
    case 'v2-experiment-initial': {
      const e = v2.experiment;
      if (
        !config.experiment ||
        !e ||
        e.stage !== 'initial' ||
        !config.experiment.choices.some((c) => c.id === action.choiceId)
      )
        return progress;
      return commit(
        { ...v2, experiment: { ...e, initialChoice: action.choiceId, stage: 'comparison' } },
        config.experiment.id,
      );
    }
    case 'v2-experiment-update': {
      const e = v2.experiment;
      if (
        !config.experiment ||
        !e ||
        e.stage !== 'comparison' ||
        !compared(config.experiment.revealDocuments) ||
        !config.experiment.choices.some((c) => c.id === action.choiceId) ||
        !action.reason.trim()
      )
        return progress;
      return commit(
        {
          ...v2,
          experiment: {
            ...e,
            updatedChoice: action.choiceId,
            reason: action.reason.slice(0, 5000),
            stage: 'complete',
          },
        },
        config.experiment.id,
      );
    }
    case 'v2-decision': {
      const d = config.decision,
        record = action.record;
      if (
        !d ||
        !record ||
        v2.decisions.length >= 100 ||
        !d.objectives.some((o) => o.id === record.objectiveId) ||
        !d.options.some((o) => o.id === record.optionId && o.cost <= d.resources) ||
        !record.reason.trim() ||
        !record.assumptions.trim() ||
        record.evidence.length === 0 ||
        !validEvidence(record.evidence) ||
        !validEvidence(record.counterEvidence) ||
        new Set([...record.evidence, ...record.counterEvidence]).size !==
          record.evidence.length + record.counterEvidence.length
      )
        return progress;
      if (v2.decisions.length > 0 && !compared(d.revealDocuments)) return progress;
      const explicitFirstReaffirmation =
        v2.decisions.length === 1 && d.revealDocuments.length > 0 && compared(d.revealDocuments);
      if (
        !explicitFirstReaffirmation &&
        JSON.stringify(v2.decisions.at(-1)) === JSON.stringify(record)
      )
        return progress;
      return commit(
        {
          ...v2,
          decisions: [
            ...v2.decisions,
            {
              ...record,
              reason: record.reason.slice(0, 5000),
              assumptions: record.assumptions.slice(0, 5000),
              evidence: [...record.evidence],
              counterEvidence: [...record.counterEvidence],
            },
          ],
        },
        record.optionId,
      );
    }
    case 'v2-report': {
      const report = {
        claim: action.claim.slice(0, 5000),
        uncertainty: action.uncertainty.slice(0, 5000),
      };
      if (v2.report.claim === report.claim && v2.report.uncertainty === report.uncertainty)
        return progress;
      return commit({ ...v2, report }, 'report');
    }
  }
}
