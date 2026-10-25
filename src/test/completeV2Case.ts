import { createProgress, reduceProgress } from '../domain/game';
import type { CaseData, CaseProgress, V2DecisionRecord } from '../domain/types';
import type { GameAction } from '../domain/game';

/** Browser-independent walkthrough driver. Uses case-authored evidence, without numeric answers. */
export function completeV2Case(
  c: CaseData,
  options: {
    path?: number;
    alternative?: boolean;
    experimentChoice?: string;
    experimentUpdatedChoice?: string;
    decisionChoice?: string;
  } = {},
): CaseProgress {
  if (!c.v2) throw new Error('V2 case required');
  let p = createProgress(c);
  const step = (action: GameAction) => {
    p = reduceProgress(c, p, action);
  };
  const pin = (documentId: string) => {
    step({ type: 'open-document', documentId });
    if (!p.pinned.includes(documentId)) step({ type: 'toggle-pin', documentId });
  };
  // The opening document is available before any conditional reveal.
  const initial = c.documents.find((d) => d.cost === 0)!;
  pin(initial.id);
  const experiment = c.v2.experiment;
  const experimentChoice = options.experimentChoice ?? experiment?.choices[0]?.id;
  if (experiment && experimentChoice)
    step({ type: 'v2-experiment-initial', choiceId: experimentChoice });
  const decision = c.v2.decision;
  const record: V2DecisionRecord | undefined = decision && {
    objectiveId: decision.objectives[0]!.id,
    optionId: options.decisionChoice ?? decision.options.find((o) => o.id === 'hold')!.id,
    reason: '初回の資料だけで確定できない点を残して方針を記録する。',
    evidence: [initial.id],
    counterEvidence: [],
    assumptions: '未確認の条件は今後の取材で確かめる。',
  };
  if (record) step({ type: 'v2-decision', record });
  const selections = c.v2.decoding.map((t) => {
    const valid = t.options.filter((o) => o.accepted);
    return { task: t, option: valid[options.alternative ? valid.length - 1 : 0]! };
  });
  const path = c.v2.graph.paths[options.path ?? 0]!;
  const mustOpen = new Set([
    ...selections.flatMap(({ option }) => option.evidence),
    ...path.flatMap((e) => [e.from, e.to]),
    ...(experiment?.revealDocuments ?? []),
    ...(decision?.revealDocuments ?? []),
  ]);
  for (const id of mustOpen) pin(id);
  for (const { task, option } of selections)
    step({ type: 'v2-decode', taskId: task.id, optionId: option.id, evidence: option.evidence });
  for (const link of path) step({ type: 'v2-link', link });
  if (experiment && experimentChoice)
    step({
      type: 'v2-experiment-update',
      choiceId: options.experimentUpdatedChoice ?? experimentChoice,
      reason: '提示範囲と開示後の比較条件を分けて考え、今回の判断を維持する。',
    });
  if (record)
    step({
      type: 'v2-decision',
      record: {
        ...record,
        reason: '追加資料でリスクと適用範囲を確認した後も、この目的と方針を条件付きで維持する。',
        evidence: selections
          .flatMap(({ option }) => option.evidence)
          .filter((v, i, arr) => arr.indexOf(v) === i && !decision!.revealDocuments.includes(v)),
        counterEvidence: decision!.revealDocuments,
      },
    });
  step({
    type: 'v2-report',
    claim: selections.map(({ option }) => option.text).join(' '),
    uncertainty:
      '原因・未回答者の意見・将来便益など、資料で確定しない点は確認した事実と分けて保留する。',
  });
  step({ type: 'submit' });
  return p;
}
