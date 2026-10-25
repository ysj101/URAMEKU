import { describe, expect, it } from 'vitest';
import {
  comparisonAvailable,
  experimentComplete,
  experimentComparison,
  experimentCondition,
} from './experiment';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';

export const experimentCase = () => {
  const data = makeV2Case();
  data.v2!.modes.push('experiment');
  data.v2!.experiment = {
    id: 'price',
    prompt: '表示条件を比べます。',
    conditions: [
      { id: 'anchor', label: '表示A', prompt: '比較価格が先に示されます。' },
      { id: 'plain', label: '表示B', prompt: '比較価格が示されません。' },
    ],
    choices: [
      { id: 'buy', text: '買う' },
      { id: 'wait', text: '保留する' },
    ],
    revealDocuments: ['c'],
    comparisonPrompt: 'どの情報が変わりましたか？',
    explanation: '表示の比較を振り返ります。',
  };
  return data;
};

const completed = (updatedChoice = 'wait') => {
  const progress = makeV2Progress();
  progress.v2!.experiment = {
    conditionId: 'anchor',
    initialChoice: 'buy',
    updatedChoice,
    reason: '比較条件を確認したため',
    stage: 'complete',
  };
  return progress;
};

describe('experiment comparison', () => {
  it('accepts both changed and unchanged reactions without assigning correctness', () => {
    expect(experimentComplete(experimentCase(), completed())).toBe(true);
    expect(experimentComplete(experimentCase(), completed('buy'))).toBe(true);
    expect(experimentComparison(experimentCase(), completed())).toMatchObject({
      initial: '買う',
      updated: '保留する',
      changed: true,
    });
  });
  it('requires both choices, the reveal sources and a comparison reason', () => {
    const progress = completed();
    expect(experimentComplete(experimentCase(), { ...progress, opened: ['a', 'b'] })).toBe(false);
    progress.v2!.experiment!.reason = '';
    expect(experimentComplete(experimentCase(), progress)).toBe(false);
    progress.v2!.experiment!.initialChoice = null;
    expect(comparisonAvailable(experimentCase(), progress)).toBe(false);
  });
  it('preserves a saved condition and rejects fabricated conditions or responses', () => {
    const progress = completed();
    progress.v2!.experiment!.conditionId = 'plain';
    expect(experimentCondition(experimentCase().v2!.experiment!, progress)?.id).toBe('plain');
    expect(
      experimentCondition(experimentCase().v2!.experiment!, structuredClone(progress))?.id,
    ).toBe('plain');
    progress.v2!.experiment!.updatedChoice = 'fake';
    expect(experimentComplete(experimentCase(), progress)).toBe(false);
  });
});
