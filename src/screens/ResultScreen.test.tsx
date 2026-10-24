import { fireEvent, render, screen } from '@testing-library/react';
import { ResultScreen } from './ResultScreen';
import type { GameApi } from '../state/useGame';
import type { CaseProgress } from '../domain/types';
import { clearedProgress, makeCase } from '../test/fixtures';

const caseData = makeCase();

/** useGame をモックせず、GameApi 型のスタブを渡す */
function makeGame(progress: CaseProgress): GameApi {
  return {
    cases: [caseData],
    current: caseData,
    progress,
    stage: 'article',
    finished: {},
    dispatch: vi.fn(),
    selectCase: vi.fn(),
    setStage: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
  };
}

describe('ResultScreen', () => {
  it('合格時は配点表を出し、差し戻し理由は出さない', () => {
    render(<ResultScreen game={makeGame(clearedProgress())} />);
    expect(screen.getByRole('table', { name: '配点の内訳' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '差し戻しの理由' })).not.toBeInTheDocument();
    expect(screen.getByText('掲載可能な記事になりました！')).toBeInTheDocument();
  });

  it('差し戻し時は不足種別だけを列挙し、正解は公開操作まで伏せる', () => {
    const game = makeGame({ ...clearedProgress(), pinned: ['a', 'b'], chosenLink: ['a', 'b'] });
    render(<ResultScreen game={game} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('必要な裏付け資料が 1 件足りません');
    expect(items[1]).toHaveTextContent('2 資料の照合が成立していません');
    // 他系統の理由は混ざらない
    expect(screen.queryByText(/数値検証メモに/)).not.toBeInTheDocument();
    expect(screen.queryByText(/見出しの断片/)).not.toBeInTheDocument();
    // 正解（資料名・照合）は公開前には出ない
    expect(screen.queryByText(/資料C/)).not.toBeInTheDocument();
    expect(screen.queryByText('答え合わせ')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '解説と正解を公開する' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'reveal' });
  });

  it('公開済みなら答え合わせを表示する', () => {
    render(
      <ResultScreen game={makeGame({ ...clearedProgress(), pinned: ['a'], revealed: true })} />,
    );
    expect(screen.getByText('答え合わせ')).toBeInTheDocument();
    expect(screen.getByText(/資料A、資料B、資料C/)).toBeInTheDocument();
  });
});
