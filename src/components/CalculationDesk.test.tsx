import { fireEvent, render, screen, within } from '@testing-library/react';
import { useReducer } from 'react';
import { CalculationDesk } from './CalculationDesk';
import { reduceProgress, type GameAction } from '../domain/game';
import type { CaseProgress } from '../domain/types';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase();
// 期待値: t1 = 45 %, t2 = 200 円（fixtures）

/** InvestigationScreen と同じく onChange → dispatch({type:'set-calculation'}) で結ぶ */
function Harness({
  initial,
  dispatchSpy,
}: {
  initial: CaseProgress;
  dispatchSpy?: (a: GameAction) => void;
}) {
  const [progress, dispatch] = useReducer(
    (p: CaseProgress, a: GameAction) => reduceProgress(caseData, p, a),
    initial,
  );
  return (
    <CalculationDesk
      caseData={caseData}
      progress={progress}
      onChange={(taskId, value) => {
        const action: GameAction = { type: 'set-calculation', taskId, value };
        dispatchSpy?.(action);
        dispatch(action);
      }}
    />
  );
}

const CORRECTNESS_WORDS = /正解|不正解|間違|誤り|合って|○|×/;

describe('CalculationDesk の構造', () => {
  it('2 問を fieldset/legend で分け、単位を添える', () => {
    render(<Harness initial={makeProgress()} />);
    const groups = screen.getAllByRole('group');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveAccessibleName(/問 1/);
    expect(groups[0]).toHaveTextContent('単位: %');
    expect(groups[1]).toHaveAccessibleName(/問 2/);
    expect(groups[1]).toHaveTextContent('単位: 円');
    expect(screen.getByRole('textbox', { name: '問1' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '問2' })).toBeInTheDocument();
  });

  it('入力済み件数は数値として読めたものだけを数える', () => {
    render(<Harness initial={makeProgress({ calculations: { t1: '４５％', t2: 'abc' } })} />);
    expect(screen.getByRole('heading', { name: /検証メモ/ })).toHaveTextContent('1 / 2 件入力済み');
  });

  it('set-calculation は生の入力で呼ばれ、正規化はしない', () => {
    const spy = vi.fn();
    render(<Harness initial={makeProgress()} dispatchSpy={spy} />);
    fireEvent.change(screen.getByRole('textbox', { name: '問2' }), {
      target: { value: '２００円' },
    });
    expect(spy).toHaveBeenCalledWith({ type: 'set-calculation', taskId: 't2', value: '２００円' });
    expect(screen.getByRole('textbox', { name: '問2' })).toHaveValue('２００円');
  });
});

describe('CalculationDesk の確認の導線', () => {
  it('未入力・読めない問いがあると role=alert で知らせ、正誤は出さない', () => {
    render(<Harness initial={makeProgress({ calculations: { t1: 'abc' } })} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: '入力内容を確認' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('2 件あります');
    expect(alert).toHaveTextContent('数値として読めません');
    expect(alert).toHaveTextContent('未入力');
    expect(alert).not.toHaveTextContent(CORRECTNESS_WORDS);
    expect(screen.getByRole('button', { name: '確認を閉じる' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('すべて読めるときは status で正規化値を一覧し、正解値でも正誤を出さない', () => {
    render(<Harness initial={makeProgress({ calculations: { t1: '４５％', t2: '2,00円' } })} />);
    fireEvent.click(screen.getByRole('button', { name: '入力内容を確認' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const status = screen.getByRole('status');
    const rows = within(status).getAllByRole('definition');
    expect(rows[0]).toHaveTextContent('45 %');
    expect(rows[1]).toHaveTextContent('200 円');
    expect(status).not.toHaveTextContent(CORRECTNESS_WORDS);
  });

  it('不正解の値を入れても正誤の表示は出ない', () => {
    render(<Harness initial={makeProgress({ calculations: { t1: '99', t2: '1' } })} />);
    fireEvent.click(screen.getByRole('button', { name: '入力内容を確認' }));
    expect(document.body).not.toHaveTextContent(CORRECTNESS_WORDS);
  });
});

describe('CalculationDesk の提出済み状態', () => {
  it('読み取り専用にし、記事の修正へ誘導する', () => {
    render(
      <Harness
        initial={makeProgress({ calculations: { t1: '45', t2: '200' }, published: true })}
      />,
    );
    for (const name of ['問1', '問2']) {
      const input = screen.getByRole('textbox', { name });
      expect(input).toHaveAttribute('readonly');
      expect(input).toBeDisabled();
    }
    expect(screen.getByRole('status')).toHaveTextContent('記事を修正してください');
  });

  it('未提出なら誘導文を出さない', () => {
    render(<Harness initial={makeProgress()} />);
    expect(screen.queryByText(/記事を修正してください/)).not.toBeInTheDocument();
  });
});
