import { describe, expect, it } from 'vitest';
import { createProgress, normalizeProgress, reduceProgress } from './game';
import { canOpenDocument, tryOpenDocument } from './budget';
import { makeV2Case } from '../test/v2Fixtures';
import { makeCase } from '../test/fixtures';
import type { CaseProgress, V2DecisionRecord } from './types';

const c = makeV2Case(['decoding', 'experiment', 'decision']);
function readAndPin(progress: CaseProgress, ids = ['a', 'b']) {
  for (const documentId of ids) {
    progress = reduceProgress(c, progress, { type: 'open-document', documentId });
  }
  return progress;
}
const record: V2DecisionRecord = {
  objectiveId: 'cost',
  optionId: 'hold',
  reason: '追加情報を待つ',
  assumptions: '条件が未確認',
  evidence: ['a'],
  counterEvidence: ['b'],
};

describe('V2 state transitions', () => {
  it('guards sealed documents in every open path and preserves stable assignment', () => {
    let p = createProgress(c);
    expect(p.v2?.experiment?.conditionId).toBe(createProgress(c).v2?.experiment?.conditionId);
    expect(canOpenDocument(c, p, 'c')).toBe(false);
    expect(tryOpenDocument(c, p, 'c').outcome).toBe('sealed');
    expect(reduceProgress(c, p, { type: 'open-document', documentId: 'c' })).toBe(p);
    p = reduceProgress(c, p, { type: 'v2-experiment-initial', choiceId: 'wait' });
    expect(canOpenDocument(c, p, 'c')).toBe(false); // decision also has an independent initial phase
    p = readAndPin(p);
    p = reduceProgress(c, p, { type: 'v2-decision', record });
    expect(canOpenDocument(c, p, 'c')).toBe(true);
  });
  it('records all three modes, updates and normalizes without losing first judgments', () => {
    let p = readAndPin(createProgress(c));
    p = reduceProgress(c, p, {
      type: 'v2-decode',
      taskId: 'scope',
      optionId: 'limited',
      evidence: ['a', 'b'],
      note: '対象範囲を確認',
    });
    p = reduceProgress(c, p, {
      type: 'v2-link',
      link: { from: 'a', to: 'b', relation: 'qualifies' },
    });
    p = reduceProgress(c, p, { type: 'v2-experiment-initial', choiceId: 'wait' });
    p = reduceProgress(c, p, { type: 'v2-decision', record });
    const beforeCompare = p;
    expect(
      reduceProgress(c, p, { type: 'v2-experiment-update', choiceId: 'buy', reason: '再検討' }),
    ).toBe(p);
    expect(
      reduceProgress(c, p, { type: 'v2-decision', record: { ...record, optionId: 'continue' } }),
    ).toBe(p);
    p = readAndPin(p, ['c']);
    p = reduceProgress(c, p, {
      type: 'v2-experiment-update',
      choiceId: 'wait',
      reason: '条件を見ても維持する',
    });
    p = reduceProgress(c, p, {
      type: 'v2-decision',
      record: { ...record, optionId: 'continue', evidence: ['a', 'c'] },
    });
    p = reduceProgress(c, p, {
      type: 'v2-report',
      claim: '対象範囲は限定される',
      uncertainty: '未調査の範囲がある',
    });
    expect(p.v2?.experiment).toMatchObject({
      initialChoice: 'wait',
      updatedChoice: 'wait',
      stage: 'complete',
    });
    expect(p.v2?.decisions.map((r) => r.optionId)).toEqual(['hold', 'continue']);
    expect(beforeCompare.v2?.decisions).toEqual([record]);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(p.v2?.history.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('rejects unknown IDs, invalid resources and duplicate submissions', () => {
    const initial = createProgress(c);
    // 答えは資料を採用する前でも記録できる（根拠の有無は評価時に自動判定）。未知の資料 ID は拒否する。
    expect(
      reduceProgress(c, initial, {
        type: 'v2-decode',
        taskId: 'scope',
        optionId: 'limited',
        evidence: ['a'],
      }).v2?.decoding.scope,
    ).toEqual({ optionId: 'limited', evidence: ['a'] });
    expect(
      reduceProgress(c, initial, {
        type: 'v2-decode',
        taskId: 'scope',
        optionId: 'limited',
        evidence: ['nope'],
      }),
    ).toBe(initial);
    let p = readAndPin(initial);
    expect(
      reduceProgress(c, p, {
        type: 'v2-decode',
        taskId: 'missing',
        optionId: 'limited',
        evidence: [],
      }),
    ).toBe(p);
    expect(
      reduceProgress(c, p, { type: 'v2-link', link: { from: 'a', to: 'a', relation: 'supports' } }),
    ).toBe(p);
    p = reduceProgress(c, p, { type: 'v2-experiment-initial', choiceId: 'buy' });
    expect(reduceProgress(c, p, { type: 'v2-experiment-initial', choiceId: 'wait' })).toBe(p);
    p = reduceProgress(c, p, { type: 'v2-decision', record });
    expect(reduceProgress(c, p, { type: 'v2-decision', record })).toBe(p);
    expect(
      reduceProgress(c, p, { type: 'v2-decision', record: { ...record, optionId: 'missing' } }),
    ).toBe(p);
    const poor = { ...c, v2: { ...c.v2!, decision: { ...c.v2!.decision!, resources: 0 } } };
    expect(
      reduceProgress(poor, p, { type: 'v2-decision', record: { ...record, optionId: 'continue' } }),
    ).toBe(p);
  });
  it('supports link removal, isolated reset and rejects V2 actions on legacy cases', () => {
    let p = readAndPin(createProgress(c));
    const action = {
      type: 'v2-link' as const,
      link: { from: 'a', to: 'b', relation: 'qualifies' as const },
    };
    p = reduceProgress(c, p, action);
    p = reduceProgress(c, p, action);
    expect(p.v2?.links).toEqual([]);
    expect(reduceProgress(c, p, { type: 'reset' })).toEqual(createProgress(c));
    const legacy = createProgress();
    expect(
      reduceProgress(makeCase(), legacy, { type: 'v2-report', claim: 'x', uncertainty: 'y' }),
    ).toBe(legacy);
  });
  it('normalizes malformed phase/history and ignores prototype keys', () => {
    const p = normalizeProgress(
      JSON.parse(
        '{"v2":{"decoding":{"__proto__":{"optionId":"x"}},"links":[null],"decisions":[null],"history":[null],"experiment":{"conditionId":"first","stage":"complete","updatedChoice":"buy"}}}',
      ),
    );
    expect(p.v2?.experiment?.stage).toBe('initial');
    expect(Object.keys(p.v2?.decoding ?? {})).toEqual([]);
    expect(p.v2?.links).toEqual([]);
    expect(p.v2?.decisions).toEqual([]);
  });
});
