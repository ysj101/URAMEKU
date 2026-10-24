import { render, screen, within } from '@testing-library/react';
import { AnswerReveal } from './AnswerReveal';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase({
  headline_fragments: [
    { id: 'f0', text: '断片0', kind: 'correct', reason: '主語が正しい。' },
    { id: 'f1', text: '断片1', kind: 'correct', reason: '分母を明示している。' },
    { id: 'f2', text: '断片2', kind: 'correct' },
    {
      id: 'f3',
      text: '断片3',
      kind: 'misread-statistic',
      reason: '相対変化を絶対値のように読んでいる。',
      evidence: ['a', 'b'],
    },
    { id: 'f4', text: '断片4' },
  ],
});

describe('AnswerReveal', () => {
  it('必要資料・照合・検証メモの答え・正しい見出しを資料名と文で出す', () => {
    render(<AnswerReveal caseData={caseData} progress={makeProgress()} />);
    expect(screen.getByRole('region', { name: '答え合わせ' })).toBeInTheDocument();
    expect(screen.getByText('資料A、資料B、資料C')).toBeInTheDocument();
    expect(screen.getByText('資料A ↔ 資料C')).toBeInTheDocument();
    expect(screen.getByText('問1：45%')).toBeInTheDocument();
    expect(screen.getByText('問2：200円')).toBeInTheDocument();
    expect(screen.getByText('断片0 ／ 断片1 ／ 断片2')).toBeInTheDocument();
  });

  it('自分の 3 断片それぞれの採点と理由・誤り型・根拠資料を出す', () => {
    render(
      <AnswerReveal caseData={caseData} progress={makeProgress({ article: ['f3', 'f0', 'f2'] })} />,
    );
    const slots = within(screen.getByRole('list', { name: '見出し断片の採点' })).getAllByRole(
      'listitem',
    );
    expect(slots).toHaveLength(3);

    expect(slots[0]).toHaveAttribute('data-status', 'incorrect');
    expect(slots[0]).toHaveTextContent('断片3');
    expect(slots[0]).toHaveTextContent('誤り');
    expect(slots[0]).toHaveTextContent('統計の誤読');
    expect(slots[0]).toHaveTextContent('相対変化を絶対値のように読んでいる。');
    expect(slots[0]).toHaveTextContent('根拠：資料A、資料B');

    expect(slots[1]).toHaveAttribute('data-status', 'wrong-position');
    expect(slots[1]).toHaveTextContent('断片は正しいが位置が違う');
    expect(slots[1]).toHaveTextContent('主語が正しい。');
    // 正しい断片には誤り型ラベルを付けない
    expect(slots[1]).not.toHaveTextContent('正しい断片');

    expect(slots[2]).toHaveAttribute('data-status', 'correct');
    expect(slots[2]).toHaveTextContent('断片2');
  });

  it('未配置のスロットと理由の無い断片も崩れずに出す', () => {
    render(<AnswerReveal caseData={caseData} progress={makeProgress({ article: ['f4'] })} />);
    const slots = within(screen.getByRole('list', { name: '見出し断片の採点' })).getAllByRole(
      'listitem',
    );
    expect(slots).toHaveLength(3);
    expect(slots[0]).toHaveAttribute('data-status', 'incorrect');
    expect(slots[0]).toHaveTextContent('断片4');
    expect(slots[1]).toHaveAttribute('data-status', 'empty');
    expect(slots[1]).toHaveTextContent('未配置');
    expect(slots[2]).toHaveAttribute('data-status', 'empty');
  });
});
