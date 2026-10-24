import type { CaseData, CaseProgress } from '../domain/types';
import { createProgress } from '../domain/game';

/** テスト用の最小ケース。実データは data/cases を参照 */
export function makeCase(overrides: Partial<CaseData> = {}): CaseData {
  return {
    id: 'case-99',
    title: 'テスト事件',
    bias: 'テスト',
    difficulty: 'NORMAL',
    estimated_time: '1分',
    intro: 'テスト用の導入文です。',
    budget: 3,
    documents: [
      { id: 'free', title: '無料資料', content: 'x', cost: 0, visual: 'advert' },
      { id: 'a', title: '資料A', content: 'x', cost: 1, visual: 'ledger' },
      { id: 'b', title: '資料B', content: 'x', cost: 1, visual: 'receipt' },
      { id: 'c', title: '資料C', content: 'x', cost: 1, visual: 'report' },
      { id: 'd', title: '資料D', content: 'x', cost: 2, visual: 'news' },
    ],
    required_evidence: ['a', 'b', 'c'],
    required_link: ['a', 'c'],
    analysis_tasks: [
      { id: 't1', prompt: '問1', unit: '%', expected: 45, tolerance: 0.1 },
      { id: 't2', prompt: '問2', unit: '円', expected: 200, tolerance: 0 },
    ],
    headline_fragments: Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, text: `断片${i}` })),
    correct_fragments: ['f0', 'f1', 'f2'],
    debrief: { explanation: '説明文です。十分な長さがあります。', takeaway: '持ち帰る視点です。' },
    disclaimer: '架空です。',
    ...overrides,
  };
}

export function makeProgress(overrides: Partial<CaseProgress> = {}): CaseProgress {
  return { ...createProgress(), ...overrides };
}

/** クリア状態の進行 */
export function clearedProgress(): CaseProgress {
  return makeProgress({
    opened: ['a', 'b', 'c'],
    pinned: ['a', 'b', 'c'],
    chosenLink: ['c', 'a'],
    calculations: { t1: '45', t2: '200' },
    article: ['f0', 'f1', 'f2'],
    published: true,
  });
}
