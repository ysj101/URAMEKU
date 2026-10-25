import { fireEvent, render, screen } from '@testing-library/react';
import { createV2Progress } from '../domain/v2Progress';
import { ExperimentDesk } from './ExperimentDesk';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';

function fixture() {
  const data = makeV2Case();
  data.v2!.experiment = {
    id: 'price',
    prompt: '提示条件を比較する体験です。',
    conditions: [
      { id: 'first', label: '表示A', prompt: '最初に比較価格を示す。' },
      { id: 'second', label: '表示B', prompt: '比較価格を示さない。' },
    ],
    choices: [
      { id: 'buy', text: '買う' },
      { id: 'hold', text: '保留する' },
    ],
    revealDocuments: ['c'],
    comparisonPrompt: '見え方は変わりましたか？',
    explanation: 'まだ開示しない種明かし。',
  };
  return data;
}

it('records an initial reaction without showing the comparison condition or explanation', () => {
  const onAction = vi.fn();
  const data = fixture();
  render(<ExperimentDesk caseData={data} progress={makeV2Progress()} onAction={onAction} />);
  fireEvent.click(screen.getByRole('button', { name: '保留する' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'v2-experiment-initial', choiceId: 'hold' });
  const assigned = createV2Progress(data).experiment!.conditionId;
  const hidden = data.v2!.experiment!.conditions.find((condition) => condition.id !== assigned)!;
  expect(screen.queryByText(hidden.prompt)).not.toBeInTheDocument();
  expect(screen.queryByText('まだ開示しない種明かし。')).not.toBeInTheDocument();
});

it('requires comparison sources before the update form and accepts unchanged choices', () => {
  const onAction = vi.fn();
  const progress = makeV2Progress({ opened: ['a', 'b'] });
  progress.v2!.experiment = {
    conditionId: 'first',
    initialChoice: 'hold',
    updatedChoice: null,
    reason: '',
    stage: 'comparison',
  };
  const { rerender } = render(
    <ExperimentDesk caseData={fixture()} progress={progress} onAction={onAction} />,
  );
  expect(screen.queryByRole('textbox', { name: '維持・変更した理由' })).not.toBeInTheDocument();
  rerender(
    <ExperimentDesk
      caseData={fixture()}
      progress={{ ...progress, opened: ['a', 'b', 'c'] }}
      onAction={onAction}
    />,
  );
  fireEvent.click(screen.getByRole('radio', { name: '保留する' }));
  fireEvent.change(screen.getByRole('textbox', { name: '維持・変更した理由' }), {
    target: { value: '条件を見ても情報が足りないため' },
  });
  fireEvent.click(screen.getByRole('button', { name: '比較後の判断を記録' }));
  expect(onAction).toHaveBeenCalledWith({
    type: 'v2-experiment-update',
    choiceId: 'hold',
    reason: '条件を見ても情報が足りないため',
  });
});

it('shows the same assigned initial condition even if an uninitialized progress is supplied', () => {
  const data = fixture();
  const assignment = createV2Progress(data).experiment!.conditionId;
  const expected = data.v2!.experiment!.conditions.find(
    (condition) => condition.id === assignment,
  )!;
  render(<ExperimentDesk caseData={data} progress={makeV2Progress()} onAction={vi.fn()} />);
  expect(screen.getByRole('heading', { name: expected.label })).toBeInTheDocument();
  expect(screen.getByText(expected.prompt)).toBeInTheDocument();
});
