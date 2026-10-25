import { fireEvent, render, screen, within } from '@testing-library/react';
import { DecisionDesk } from './DecisionDesk';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';

function fixture() {
  const data = makeV2Case();
  data.v2!.decision = {
    prompt: '不確実な情報から方針を決めてください。',
    objectives: [{ id: 'safety', text: '損失を抑える' }],
    resources: 1,
    revealDocuments: ['c'],
    updatePrompt: '新たな資料で方針を見直す。',
    options: [
      {
        id: 'hold',
        text: '保留',
        cost: 0,
        outcome: '判断は保留になる。',
        tradeoff: '時間は経過する。',
      },
      {
        id: 'go',
        text: '継続',
        cost: 1,
        outcome: '需要があれば回復の可能性。',
        tradeoff: '資源を消費する。',
      },
      { id: 'expand', text: '拡大', cost: 2, outcome: '対象外。', tradeoff: '資源不足。' },
    ],
  };
  return data;
}

it('records a purpose, a policy, opposing sources and explicit assumptions', () => {
  const onAction = vi.fn();
  render(<DecisionDesk caseData={fixture()} progress={makeV2Progress()} onAction={onAction} />);
  fireEvent.change(screen.getByRole('combobox', { name: '優先する目的' }), {
    target: { value: 'safety' },
  });
  fireEvent.click(screen.getByRole('radio', { name: /保留/ }));
  fireEvent.click(
    within(screen.getByRole('group', { name: '方針を支える資料' })).getByRole('checkbox', {
      name: '資料A',
    }),
  );
  expect(
    within(screen.getByRole('group', { name: '反対の見方・制約を示す資料' })).getByRole(
      'checkbox',
      { name: '資料A' },
    ),
  ).toBeDisabled();
  fireEvent.click(
    within(screen.getByRole('group', { name: '反対の見方・制約を示す資料' })).getByRole(
      'checkbox',
      { name: '資料B' },
    ),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'この判断が成り立つ前提・不確実な点' }), {
    target: { value: '需要は未確定' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: '目的と根拠を踏まえた選択理由' }), {
    target: { value: '調べる時間を取る' },
  });
  fireEvent.click(screen.getByRole('button', { name: '判断を記録' }));
  expect(onAction).toHaveBeenCalledWith({
    type: 'v2-decision',
    record: {
      objectiveId: 'safety',
      optionId: 'hold',
      reason: '調べる時間を取る',
      assumptions: '需要は未確定',
      evidence: ['a'],
      counterEvidence: ['b'],
    },
  });
  expect(screen.getByRole('radio', { name: /拡大/ })).toBeDisabled();
  expect(screen.queryByText('判断は保留になる。')).not.toBeInTheDocument();
});

it('waits for newly revealed documents before accepting an update', () => {
  const progress = makeV2Progress({ opened: ['a', 'b'] });
  progress.v2!.decisions = [
    {
      objectiveId: 'safety',
      optionId: 'hold',
      reason: '調べる',
      assumptions: '未確定',
      evidence: ['a'],
      counterEvidence: ['b'],
    },
  ];
  render(<DecisionDesk caseData={fixture()} progress={progress} onAction={vi.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('新たに閲覧できる資料を確認');
  expect(screen.queryByRole('button', { name: '判断を記録' })).not.toBeInTheDocument();
  expect(screen.getByRole('list', { name: '判断の履歴' })).toHaveTextContent('最初の判断');
});
