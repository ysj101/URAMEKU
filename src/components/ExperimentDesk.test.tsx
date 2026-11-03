import { fireEvent, render, screen, within } from '@testing-library/react';
import { V2_CONTENT_CASES } from '../test/v2ContentCases';
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

const priceCase = V2_CONTENT_CASES[1]!;
const majorityCase = V2_CONTENT_CASES[2]!;

it.each(['sale_first', 'price_first'])(
  'shows the same backstory in %s and records the choice immediately',
  (conditionId) => {
    const progress = makeV2Progress();
    progress.v2 = createV2Progress(priceCase);
    progress.v2.experiment!.conditionId = conditionId;
    const onAction = vi.fn();
    const { container } = render(
      <ExperimentDesk caseData={priceCase} progress={progress} onAction={onAction} />,
    );
    expect(screen.getByText(/前から欲しかったスニーカー/)).toHaveTextContent(
      '予算を超えていたので買いませんでした',
    );
    expect(screen.getByText(/前から欲しかったスニーカー/)).toHaveTextContent(
      '今も欲しい気持ちは変わっていません',
    );
    expect(
      screen.getByText('深く考えず、直感で選んでください。あとで変えてもOKです。'),
    ).toBeVisible();
    expect(container.querySelectorAll('.btn.primary')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '今回は買わない' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'v2-experiment-initial', choiceId: 'pass' });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  },
);

it.each(['buy', 'hold'])(
  'waits for both sources, accepts %s after comparison and shows the column only when complete',
  (choiceId) => {
    const progress = makeV2Progress({ opened: [] });
    progress.v2 = createV2Progress(priceCase);
    Object.assign(progress.v2.experiment!, { initialChoice: 'hold', stage: 'comparison' });
    const onAction = vi.fn();
    const props = { caseData: priceCase, progress, onAction };
    const { container, rerender } = render(<ExperimentDesk {...props} />);
    const primaryCount = (count: number) =>
      expect(container.querySelectorAll('.btn.primary')).toHaveLength(count);
    primaryCount(0);
    expect(screen.getByRole('status')).toHaveTextContent('次は資料を読んでみよう');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    progress.opened = ['history'];
    rerender(<ExperimentDesk {...props} />);
    primaryCount(0);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    progress.opened = ['history', 'stock'];
    rerender(<ExperimentDesk {...props} />);
    primaryCount(1);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'この選択を記録する →' });
    expect(submit).toBeDisabled();
    fireEvent.click(
      screen.getByRole('radio', {
        name: priceCase.v2!.experiment!.choices.find((c) => c.id === choiceId)!.text,
      }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'そう選んだ理由' }), {
      target: { value: '使い道と予算で考えた。' },
    });
    fireEvent.click(submit);
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'v2-experiment-update',
      choiceId,
      reason: '使い道と予算で考えた。',
    });
    Object.assign(progress.v2!.experiment!, {
      updatedChoice: choiceId,
      reason: '使い道と予算で考えた。',
      stage: 'complete',
    });
    rerender(<ExperimentDesk {...props} />);
    primaryCount(0);
    const column = screen.getByRole('complementary', { name: '「お得」は何と比べている？' });
    expect(column).toHaveTextContent('参照価格');
    expect(column).toHaveTextContent('1985年');
    expect(column).toHaveTextContent(
      'セイラーは行動経済学への貢献で、2017年にノーベル経済学賞を受けました。',
    );
    expect(column).toHaveTextContent(
      '今回の1回だけで、価格の見せ方が選択を変えたとは言い切れません。',
    );
    expect(column).not.toHaveTextContent(/(?:アンカリング|参照価格)(?:が|は).*受賞/);
    expect(column).toHaveTextContent('セールは参照価格を高く感じさせ、同じ値段でもお得に見せる');
    expect(column).toHaveTextContent('参照価格の考え方そのものが受賞したわけではありません。');
    expect(
      within(column)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      'https://doi.org/10.1287/mksc.4.3.199',
      'https://www.nobelprize.org/prizes/economic-sciences/2017/popular-information/',
      'https://www.nobelprize.org/prizes/economic-sciences/2017/press-release/',
    ]);
    expect(column).toHaveTextContent(priceCase.v2!.experiment!.explanation);
    expect(within(screen.getByRole('status')).queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).not.toHaveTextContent('参照価格');
  },
);

it.each(['initial', 'waiting', 'comparison', 'complete'] as const)(
  'preserves CASE03 visible text at %s',
  (stage) => {
    const progress = makeV2Progress({
      opened: stage === 'comparison' || stage === 'complete' ? ['invite', 'population'] : [],
    });
    progress.v2 = createV2Progress(majorityCase);
    Object.assign(progress.v2.experiment!, {
      conditionId: 'count_first',
      initialChoice: stage === 'initial' ? null : 'hold',
      updatedChoice: stage === 'complete' ? 'hold' : null,
      reason: stage === 'complete' ? '理由は変わらない。' : '',
      stage: stage === 'initial' ? 'initial' : stage === 'complete' ? 'complete' : 'comparison',
    });
    const { container } = render(
      <ExperimentDesk caseData={majorityCase} progress={progress} onAction={vi.fn()} />,
    );
    expect(
      screen.getByText(
        '速報の第一印象として、このサービスをどう扱うか記録してください。支持・反対・保留のいずれにも正解を設定しません。',
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        'これは、情報の見え方をふり返るための小さな体験です。一度の反応だけで、その人の特徴を決めつけることはしません。記録はこの端末に保存します。',
      ),
    ).toBeVisible();
    expect(container.querySelectorAll('.btn.primary')).toHaveLength(stage === 'comparison' ? 1 : 0);
    if (stage === 'initial') {
      expect(screen.getByRole('heading', { name: '提示B' })).toBeVisible();
      expect(
        screen.getByText(
          '回答者200人中160人が支持。速報の大見出しは利用者の80%が支持となっている。サービスの採用をどう考える？',
        ),
      ).toBeVisible();
      const group = screen.getByRole('group', { name: '今ある情報での判断' });
      expect(
        within(group)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual([
        '自分の用途に合うか試してみたい',
        '自分の判断材料としては慎重に扱う',
        '採用を見送る',
        '募集方法を調べるまで保留する',
      ]);
    } else {
      expect(screen.getByText('最初の判断：').closest('p')).toHaveTextContent(
        '最初の判断：募集方法を調べるまで保留する',
      );
    }
    if (stage === 'waiting') {
      expect(screen.getByRole('status')).toHaveTextContent(
        'ここからは比べる段階です。新しく開けるようになった調査資料を読んでから、もう一度判断してください。',
      );
    }
    if (stage === 'comparison') {
      expect(screen.getByRole('heading', { name: '提示条件を比べる' })).toBeVisible();
      expect(screen.getByText('提示A：').closest('li')).toHaveTextContent(
        '提示A：利用者の80%が新サービスを支持！ 回答者200人中160人が支持した速報がある。サービスの採用をどう考える？',
      );
      expect(screen.getByText('提示B：').closest('li')).toHaveTextContent(
        '提示B：回答者200人中160人が支持。速報の大見出しは利用者の80%が支持となっている。サービスの採用をどう考える？',
      );
      expect(
        screen.getByText(
          '募集方法を知った後、サービスへの判断と、80%という表現が言える範囲をそれぞれどう考えるか記録してください。',
        ),
      ).toBeVisible();
      expect(
        screen.getByRole('group', { name: '比較後の判断（変わらなくても構いません）' }),
      ).toBeVisible();
      expect(screen.getByRole('textbox', { name: '維持・変更した理由' })).toBeVisible();
      expect(screen.getByRole('button', { name: '比較後の判断を記録' })).toBeDisabled();
      expect(screen.getAllByRole('radio').map((radio) => radio.parentElement?.textContent)).toEqual(
        [
          '自分の用途に合うか試してみたい',
          '自分の判断材料としては慎重に扱う',
          '採用を見送る',
          '募集方法を調べるまで保留する',
        ],
      );
    }
    if (stage === 'complete') {
      expect(screen.getByRole('status')).toHaveTextContent(
        '比較後の判断：募集方法を調べるまで保留する',
      );
      expect(screen.getByRole('status')).toHaveTextContent('理由は変わらない。');
      expect(screen.getByRole('status')).toHaveTextContent(
        '最初の判断と、比べたあとの判断を記録しました。反応の違いに、正解・不正解は付けません。',
      );
    }
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  },
);
