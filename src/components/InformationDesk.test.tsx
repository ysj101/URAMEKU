import { fireEvent, render, screen } from '@testing-library/react';
import { InformationDesk } from './InformationDesk';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';

it('renders choices and adopted sources without leaking facts or reasons', () => {
  const onAction = vi.fn();
  const data = makeV2Case();
  const progress = makeV2Progress();
  render(<InformationDesk caseData={data} progress={progress} onAction={onAction} />);
  const choice = screen.getByRole('radio', { name: '調査対象外は未確認' });
  fireEvent.click(choice);
  // 根拠は答えが参照する資料（JSON 定義）をそのまま記録し、手動では選ばせない
  expect(onAction).toHaveBeenCalledWith({
    type: 'v2-decode',
    taskId: 'scope',
    optionId: 'open',
    evidence: ['a', 'b'],
    note: undefined,
  });
  expect(screen.queryByText('対象外を示す資料がない。')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('lists the referenced sources with their read state and no manual picking', () => {
  const progress = makeV2Progress();
  progress.v2!.decoding.scope = { optionId: 'open', evidence: ['a', 'b'] };
  progress.opened = ['a'];
  render(<InformationDesk caseData={makeV2Case()} progress={progress} onAction={vi.fn()} />);
  const refs = screen.getByRole('region', { name: 'この答えのもとになる資料' });
  expect(refs).toHaveTextContent('資料A読んだ');
  expect(refs).toHaveTextContent('資料Bまだ読んでいない');
  expect(screen.getByRole('status')).toHaveTextContent('まだ読んでいない資料があります');
  expect(screen.getByText('問 1 ・ 回答済み ・ まだ読んでいない資料 1 件')).toBeInTheDocument();
});

it('allows revising notes, with native keyboard-accessible controls', () => {
  const onAction = vi.fn();
  const progress = makeV2Progress();
  progress.v2!.decoding.scope = { optionId: 'open', evidence: ['a'] };
  render(<InformationDesk caseData={makeV2Case()} progress={progress} onAction={onAction} />);
  expect(screen.getByText('問 1 ・ 回答済み ・ 根拠 2 件')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '補足メモ（任意）' }), {
    target: { value: '期間が異なる' },
  });
  expect(onAction).toHaveBeenLastCalledWith({
    type: 'v2-decode',
    taskId: 'scope',
    optionId: 'open',
    evidence: ['a', 'b'],
    note: '期間が異なる',
  });
});
