import { describe, expect, it } from 'vitest';
import { evaluateV2Case } from './v2Evaluation';
import { publishVerdict, canSubmitArticle } from './publish';
import { evaluateCase, failureReasons } from './scoring';
import { reduceProgress } from './game';
import { caseStatus } from './caseStatus';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';
import type { V2DecisionRecord } from './types';

function complete() {
  const progress = makeV2Progress();
  progress.v2!.decoding.scope = { optionId: 'limited', evidence: ['a', 'b'] };
  progress.v2!.links = [{ from: 'a', to: 'b', relation: 'qualifies' }];
  progress.v2!.report = {
    claim: '資料の対象に限って支持される。',
    uncertainty: '対象外への適用は未確認。',
  };
  return progress;
}

describe('V2 evaluation', () => {
  it('completes grounded decoding with no numerical answers, points or fixed headline', () => {
    const data = makeV2Case();
    const progress = complete();
    expect(evaluateV2Case(data, progress).completed).toBe(true);
    expect(publishVerdict(data, progress).approved).toBe(true);
    expect(evaluateCase(data, progress)).toMatchObject({
      cleared: true,
      points: 0,
      breakdown: [],
      calculationsTotal: 0,
    });
    expect(canSubmitArticle(progress)).toBe(true);
    expect(progress.calculations).toEqual({});
    expect(progress.article).toEqual([]);
  });
  it('accepts uncertainty and alternative evidence paths without treating them as failure', () => {
    const progress = complete();
    progress.v2!.decoding.scope!.optionId = 'open';
    progress.v2!.links = [{ from: 'a', to: 'c', relation: 'contradicts' }];
    const review = evaluateV2Case(makeV2Case(), progress);
    expect(review.completed).toBe(true);
    expect(review.uncertainties).toContain('調査対象外は未確認');
    expect(review.factualErrors).toEqual([]);
  });
  it('separates factual errors from incomplete or unsupported work', () => {
    const progress = complete();
    progress.v2!.decoding.scope!.optionId = 'everyone';
    const review = evaluateV2Case(makeV2Case(), progress);
    expect(review.completed).toBe(false);
    expect(review.factualErrors).toEqual([
      { taskId: 'scope', message: '資料の対象範囲を超えている。', evidence: ['a', 'b'] },
    ]);
    expect(
      failureReasons(makeV2Case(), progress)
        .map((reason) => reason.message)
        .join(' '),
    ).not.toMatch(/資料A|資料B|対象範囲を超えて/);
    progress.v2!.decoding.scope!.optionId = 'limited';
    progress.pinned = ['a'];
    expect(evaluateV2Case(makeV2Case(), progress).factualErrors).toEqual([]);
    expect(evaluateV2Case(makeV2Case(), progress).completed).toBe(false);
  });
  it('never completes from an article guess or an empty legacy state', () => {
    const progress = makeV2Progress();
    progress.v2!.report = { claim: '結論だけ推測', uncertainty: '未確認' };
    expect(canSubmitArticle(progress)).toBe(true);
    expect(evaluateV2Case(makeV2Case(), progress).completed).toBe(false);
    delete progress.v2;
    expect(evaluateV2Case(makeV2Case(), progress).completed).toBe(false);
  });
  it.each(['buy', 'hold'])(
    'accepts any recorded experiment reaction %s after comparison',
    (choiceId) => {
      const data = makeV2Case();
      data.v2!.modes.push('experiment');
      data.v2!.experiment = {
        id: 'price',
        prompt: '提示を比べる',
        conditions: [
          { id: 'a', label: '表示A', prompt: '比較価格あり' },
          { id: 'b', label: '表示B', prompt: '比較価格なし' },
        ],
        choices: [
          { id: 'buy', text: '買う' },
          { id: 'hold', text: '保留' },
        ],
        revealDocuments: ['c'],
        comparisonPrompt: '見直す',
        explanation: '体験を振り返る',
      };
      const progress = complete();
      progress.v2!.experiment = {
        conditionId: 'a',
        initialChoice: 'buy',
        updatedChoice: choiceId,
        reason: '条件を比較した',
        stage: 'complete',
      };
      expect(evaluateV2Case(data, progress).completed).toBe(true);
      progress.v2!.experiment.stage = 'comparison';
      expect(evaluateV2Case(data, progress).completed).toBe(false);
    },
  );
  it.each(['continue', 'stop', 'hold'])(
    'accepts grounded decisions %s, including unfavourable outcomes',
    (optionId) => {
      const data = makeV2Case();
      data.v2!.modes.push('decision');
      data.v2!.decision = {
        prompt: '方針を決める',
        objectives: [{ id: 'safety', text: '損失を抑える' }],
        resources: 1,
        revealDocuments: ['c'],
        updatePrompt: '新しい情報で更新',
        options: ['continue', 'stop', 'hold'].map((id) => ({
          id,
          text: id,
          cost: 0,
          outcome: id === 'continue' ? '需要が不足し損失が残る可能性。' : '機会を逃す可能性。',
          tradeoff: '将来は不確実。',
        })),
      };
      const progress = complete();
      const record: V2DecisionRecord = {
        objectiveId: 'safety',
        optionId,
        evidence: ['a'],
        counterEvidence: ['b'],
        reason: 'この目的と情報なら成立する方針',
        assumptions: '需要が見込みどおりとは限らない',
      };
      progress.v2!.decisions = [{ ...record, reason: '最初の情報での理由' }, record];
      expect(evaluateV2Case(data, progress).completed).toBe(true);
      expect(evaluateV2Case(data, progress).decisionHistory).toHaveLength(2);
      progress.v2!.decisions[1]!.counterEvidence = [];
      expect(evaluateV2Case(data, progress).completed).toBe(false);
    },
  );
  it('freezes V2 work after submission and reflects progress before any document opens', () => {
    const data = makeV2Case();
    const progress = complete();
    progress.published = true;
    expect(
      reduceProgress(data, progress, {
        type: 'v2-report',
        claim: 'changed',
        uncertainty: 'changed',
      }),
    ).toBe(progress);
    expect(
      reduceProgress(data, progress, {
        type: 'v2-decode',
        taskId: 'scope',
        optionId: 'everyone',
        evidence: ['a', 'b'],
      }),
    ).toBe(progress);
    progress.published = false;
    expect(caseStatus(data.id, progress, {})).toBe('draft');
    progress.v2!.report = { claim: '', uncertainty: '' };
    progress.opened = [];
    progress.pinned = [];
    expect(caseStatus(data.id, progress, {})).toBe('investigating');
  });
});
