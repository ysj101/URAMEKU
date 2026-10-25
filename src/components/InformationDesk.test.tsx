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
  expect(onAction).toHaveBeenCalledWith({
    type: 'v2-decode',
    taskId: 'scope',
    optionId: 'open',
    evidence: [],
    note: undefined,
  });
  expect(screen.queryByText('対象外を示す資料がない。')).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '資料A' })).toBeDisabled();
});

it('allows revising sources and notes, with native keyboard-accessible controls', () => {
  const onAction = vi.fn();
  const progress = makeV2Progress();
  progress.v2!.decoding.scope = { optionId: 'open', evidence: ['a'] };
  render(<InformationDesk caseData={makeV2Case()} progress={progress} onAction={onAction} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '資料B' }));
  expect(onAction).toHaveBeenLastCalledWith({
    type: 'v2-decode',
    taskId: 'scope',
    optionId: 'open',
    evidence: ['a', 'b'],
    note: undefined,
  });
  fireEvent.change(screen.getByRole('textbox', { name: '補足メモ（任意）' }), {
    target: { value: '期間が異なる' },
  });
  expect(onAction).toHaveBeenLastCalledWith({
    type: 'v2-decode',
    taskId: 'scope',
    optionId: 'open',
    evidence: ['a'],
    note: '期間が異なる',
  });
});
