import type { CaseData, V2Mode } from '../domain/types';
import { makeCase } from './fixtures';

export function makeV2Case(modes: V2Mode[] = ['decoding']): CaseData {
  return makeCase({
    schemaVersion: 2,
    analysis_tasks: [],
    required_evidence: [],
    required_link: [],
    headline_fragments: [],
    correct_fragments: [],
    v2: {
      revision: 1,
      modes,
      decoding: modes.includes('decoding')
        ? [
            {
              id: 'scope',
              prompt: '主張の対象範囲を確認してください。',
              options: [
                {
                  id: 'limited',
                  text: '確認した対象に限られる',
                  status: 'supported',
                  accepted: true,
                  reason: '対象を限定する資料があるためです。',
                  evidence: ['a', 'b'],
                },
                {
                  id: 'all',
                  text: '全員に当てはまる',
                  status: 'contradicted',
                  accepted: false,
                  reason: '確認した対象以外への一般化です。',
                  evidence: ['a'],
                },
              ],
            },
          ]
        : [],
      graph: {
        prompt: '対象と比較条件を突き合わせて関係を記録する。',
        paths: [[{ from: 'a', to: 'b', relation: 'qualifies' }]],
      },
      ...(modes.includes('experiment')
        ? {
            experiment: {
              id: 'reference',
              prompt: '最初の表示を見て考える。',
              conditions: [{ id: 'first', label: '条件A', prompt: '最初の価格表示' }],
              choices: [
                { id: 'buy', text: '購入を検討する' },
                { id: 'wait', text: '判断を保留する' },
              ],
              revealDocuments: ['c'],
              comparisonPrompt: '追加資料を読み比較する。',
              explanation: '一回の反応は個人特性を示しません。',
            },
          }
        : {}),
      ...(modes.includes('decision')
        ? {
            decision: {
              prompt: '目的と前提を明確に方針を選ぶ。',
              objectives: [
                { id: 'quality', text: '品質を優先する' },
                { id: 'cost', text: '費用を抑える' },
              ],
              options: [
                {
                  id: 'continue',
                  text: '継続する',
                  outcome: '条件付きで継続する。',
                  tradeoff: '追加資源を使う。',
                  cost: 1,
                },
                {
                  id: 'hold',
                  text: '保留する',
                  outcome: '情報を待つ。',
                  tradeoff: '判断が遅れる。',
                  cost: 0,
                },
              ],
              resources: 1,
              revealDocuments: ['c'],
              updatePrompt: '追加情報を受けて判断を更新する。',
            },
          }
        : {}),
      reportPrompt: '確認できたことと不確実なことを報告する。',
    },
  });
}
