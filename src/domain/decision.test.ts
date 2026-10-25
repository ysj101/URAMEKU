import { expect, it } from 'vitest';
import { decisionComplete, decisionOutcome, reviewDecisionRecord } from './decision';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';
import type { V2DecisionRecord } from './types';

export function decisionCase() {
  const data = makeV2Case();
  data.v2!.modes.push('decision');
  data.v2!.decision = {
    prompt: '異なる目的で方針を考えます。',
    objectives: [
      { id: 'protect', text: '損失を抑える' },
      { id: 'grow', text: '成長を重視する' },
    ],
    resources: 2,
    revealDocuments: ['c'],
    updatePrompt: '追加情報で判断を更新してください。',
    options: [
      {
        id: 'continue',
        text: '継続',
        cost: 2,
        outcome: '好調なら回復するが需要は未確定。',
        tradeoff: '資源を使う。',
      },
      {
        id: 'stop',
        text: '撤退',
        cost: 0,
        outcome: '追加損失を抑えるが機会は失う。',
        tradeoff: '今後の機会を失う。',
      },
      {
        id: 'hold',
        text: '保留',
        cost: 0,
        outcome: '不確実性を残し判断を留保。',
        tradeoff: '時間が経過する。',
      },
      { id: 'expand', text: '拡大', cost: 3, outcome: '試算外。', tradeoff: '資源不足。' },
    ],
  };
  return data;
}

const record = (optionId: string): V2DecisionRecord => ({
  objectiveId: 'protect',
  optionId,
  reason: 'この目的に対して資源を残したい',
  assumptions: '需要の見込みはまだ不確実',
  evidence: ['a'],
  counterEvidence: ['b'],
});

it.each(['continue', 'stop', 'hold'])(
  'allows a grounded policy %s independently of outcome luck',
  (optionId) => {
    const data = decisionCase();
    const progress = makeV2Progress();
    progress.v2!.decisions = [record('continue'), record(optionId)];
    expect(decisionComplete(data, progress)).toBe(true);
    expect(decisionOutcome(data, progress)?.option.id).toBe(optionId);
    expect(decisionOutcome(data, progress)?.counterfactuals).toHaveLength(3);
  },
);

it('requires initial and updated reasoning, sources and conditions', () => {
  const data = decisionCase();
  const progress = makeV2Progress();
  progress.v2!.decisions = [record('hold')];
  expect(decisionComplete(data, progress)).toBe(false);
  progress.v2!.decisions.push(record('stop'));
  expect(decisionComplete(data, { ...progress, opened: ['a', 'b'] })).toBe(false);
  progress.v2!.decisions[1]!.assumptions = '';
  expect(decisionComplete(data, progress)).toBe(false);
});

it('rejects insufficient resources, fabricated objectives and reused support/counter-evidence', () => {
  const data = decisionCase();
  const progress = makeV2Progress();
  expect(reviewDecisionRecord(data, progress, record('expand')).affordable).toBe(false);
  expect(
    reviewDecisionRecord(data, progress, { ...record('hold'), objectiveId: 'fake' }).recorded,
  ).toBe(false);
  expect(
    reviewDecisionRecord(data, progress, { ...record('hold'), counterEvidence: ['a'] }).grounded,
  ).toBe(false);
  expect(
    reviewDecisionRecord(data, progress, { ...record('hold'), evidence: ['fake'] }).grounded,
  ).toBe(false);
});

it('keeps an alternative evidence route affordable and detects an exhausted route', async () => {
  const { deadEndReason } = await import('./deadEnd');
  const data = makeV2Case();
  data.budget = 2;
  data.v2!.decoding[0]!.options[1]!.evidence = ['a', 'c'];
  expect(deadEndReason(data, makeV2Progress({ opened: ['a', 'c'], pinned: [] })).deadEnd).toBe(
    false,
  );
  expect(deadEndReason(data, makeV2Progress({ opened: ['d'], pinned: [] })).deadEnd).toBe(true);
});
