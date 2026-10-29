import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { V2EvidenceBoard } from './V2EvidenceBoard';
import { V2_CONTENT_CASES } from '../test/v2ContentCases';
import { createProgress, reduceProgress, type GameAction } from '../domain/game';
import { boardReviews } from '../domain/board';
import type { CaseProgress } from '../domain/types';

const data = V2_CONTENT_CASES[0]!;
const board = data.v2!.board!;
const task = board.tasks[0]!;
function Harness({ published = false }: { published?: boolean }) {
  const [progress, onAction] = useReducer(
    (value: CaseProgress, action: GameAction) => reduceProgress(data, value, action),
    {
      ...createProgress(data),
      opened: ['trial', 'paid', 'retained', 'ad'],
      published,
    },
  );
  return (
    <>
      <V2EvidenceBoard caseData={data} progress={progress} onAction={onAction} />
      <output data-testid="accepted">{String(boardReviews(data, progress)[0]?.accepted)}</output>
    </>
  );
}

it('builds a statement with quoted evidence, persists the draft and allows correction without revealing the verdict', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '文と証拠を記録' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '文の部分：誰について' }));
  await user.click(screen.getByRole('button', { name: '無料体験に登録した人' }));
  const sources = screen.getByRole('group', { name: 'この文に添える証拠' });
  expect(sources).not.toHaveTextContent('広告担当者のメモ');
  for (const id of task.rules[0]!.evidence) {
    const excerpt = board.excerpts.find((entry) => entry.id === id)!;
    const title = data.documents.find((doc) => doc.id === excerpt.documentId)!.title;
    await user.click(within(sources).getByText(title, { exact: true }));
    await user.click(within(sources).getByRole('checkbox', { name: excerpt.quote }));
  }
  await user.click(screen.getByRole('radio', { name: '内容を直す' }));
  await user.click(screen.getByRole('button', { name: '文と証拠を記録' }));
  expect(screen.getByText('文と証拠を記録済み 1 / 2 件')).toBeInTheDocument();
  expect(screen.getByTestId('accepted')).toHaveTextContent('false');
  expect(screen.queryByText(/不正解|正解です|見直しましょう/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^登録者全体の調査メモ/ }));
  await user.click(screen.getByRole('button', { name: /^広告の対象/ }));
  expect(screen.getByRole('button', { name: '文の部分：誰について' })).toHaveTextContent(
    '無料体験に登録した人',
  );
  // The open part editor is retained when switching between statements.
  await user.click(screen.getByRole('button', { name: '有料契約へ移った人' }));
  expect(screen.getByText(/変更はまだ記録していません/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '文と証拠を記録' }));
  expect(screen.getByTestId('accepted')).toHaveTextContent('true');
});

it('supports keyboard part editing and disables writes after publication', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<Harness />);
  const part = screen.getByRole('button', { name: '文の部分：誰について' });
  while (document.activeElement !== part) await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('group', { name: '文の部品：誰について' })).toBeInTheDocument();
  unmount();
  render(<Harness published />);
  expect(screen.getByRole('button', { name: '文の部分：誰について' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '文と証拠を記録' })).toBeDisabled();
});
