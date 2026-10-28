import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { V2EvidenceBoard } from './V2EvidenceBoard';
import { reduceProgress, type GameAction } from '../domain/game';
import type { CaseProgress } from '../domain/types';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';

const data = makeV2Case();
function Harness() {
  const [progress, onAction] = useReducer(
    (value: CaseProgress, action: GameAction) => reduceProgress(data, value, action),
    makeV2Progress(),
  );
  return <V2EvidenceBoard caseData={data} progress={progress} onAction={onAction} />;
}

it('adds, changes roles and removes multiple links without showing correctness', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const from = screen.getByRole('combobox', { name: /起点となる資料/ });
  await user.selectOptions(from, 'a');
  await user.selectOptions(screen.getByRole('combobox', { name: /結び付ける資料/ }), 'b');
  await user.selectOptions(screen.getByRole('combobox', { name: /関係の役割/ }), 'qualifies');
  // 追加前に「A は B の…」の 1 文で確認できる
  expect(screen.getByTestId('link-preview')).toHaveTextContent(
    '「資料A」 は 「資料B」 の適用範囲・条件を補う',
  );
  await user.click(screen.getByRole('button', { name: '関係を追加' }));
  expect(screen.getByRole('list', { name: '記録した関係' })).toHaveTextContent(
    '「資料A」 は 「資料B」 の適用範囲・条件を補う',
  );
  await user.selectOptions(screen.getByRole('combobox', { name: /結び付ける資料/ }), 'c');
  await user.click(screen.getByRole('button', { name: '関係を追加' }));
  expect(
    within(screen.getByRole('list', { name: '記録した関係' })).getAllByRole('listitem'),
  ).toHaveLength(2);
  await user.selectOptions(screen.getByRole('combobox', { name: '関係 1 の役割' }), 'contradicts');
  expect(screen.getByRole('combobox', { name: '関係 1 の役割' })).toHaveValue('contradicts');
  await user.click(screen.getByRole('button', { name: '資料A から 資料B の関係を削除' }));
  expect(
    within(screen.getByRole('list', { name: '記録した関係' })).getAllByRole('listitem'),
  ).toHaveLength(1);
  expect(screen.queryByText(/正解|不正解|一致しました/)).not.toBeInTheDocument();
});

it('supports keyboard operation without dragging and lists every read source', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.queryByRole('button', { name: /をボードから外す/ })).not.toBeInTheDocument();
  expect(screen.getByText('読んだ資料 3 件から選べます。')).toBeInTheDocument();
  await user.tab();
  expect(screen.getByRole('combobox', { name: /起点となる資料/ })).toHaveFocus();
  fireEvent.change(screen.getByRole('combobox', { name: /起点となる資料/ }), {
    target: { value: 'b' },
  });
  expect(screen.getByRole('combobox', { name: /結び付ける資料/ })).not.toHaveTextContent('資料B');
});
