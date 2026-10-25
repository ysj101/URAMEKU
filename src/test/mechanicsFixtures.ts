import type { CaseData, CaseProgress } from '../domain/types';
import { makeCase, makeProgress } from './fixtures';

export function makeV2Case(overrides: Partial<CaseData> = {}): CaseData {
  return makeCase({
    schemaVersion: 2,
    analysis_tasks: [],
    v2: {
      revision: 1,
      modes: ['decoding'],
      decoding: [
        {
          id: 'scope',
          prompt: 'この主張はどの範囲で言えますか？',
          options: [
            {
              id: 'limited',
              text: '調査対象の範囲で支持される',
              status: 'supported',
              accepted: true,
              reason: '対象者の記録に限って裏付けられる。',
              evidence: ['a', 'b'],
            },
            {
              id: 'open',
              text: '調査対象外は未確認',
              status: 'uncertain',
              accepted: true,
              reason: '対象外を示す資料がない。',
              evidence: ['a', 'b'],
            },
            {
              id: 'everyone',
              text: 'すべての人に当てはまる',
              status: 'contradicted',
              accepted: false,
              reason: '資料の対象範囲を超えている。',
              evidence: ['a', 'b'],
            },
          ],
        },
      ],
      graph: {
        prompt: '主張と、その適用範囲を示す情報を関連付けてください。',
        paths: [
          [{ from: 'a', to: 'b', relation: 'qualifies' }],
          [{ from: 'a', to: 'c', relation: 'contradicts' }],
        ],
      },
      reportPrompt: '裏付けられた事実と、なお未確認のことを記録してください。',
    },
    ...overrides,
  });
}

export function makeV2Progress(overrides: Partial<CaseProgress> = {}): CaseProgress {
  return makeProgress({
    opened: ['a', 'b', 'c'],
    pinned: ['a', 'b', 'c'],
    v2: {
      decoding: {},
      links: [],
      decisions: [],
      report: { claim: '', uncertainty: '' },
      history: [],
    },
    ...overrides,
  });
}
