import { fireEvent, render, screen } from '@testing-library/react';
import { InvestigationScreen } from './InvestigationScreen';
import type { GameApi } from '../state/useGame';
import type { CaseProgress } from '../domain/types';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase();

/** useGame をモックせず、GameApi 型のスタブを渡す */
function makeGame(progress: CaseProgress): GameApi {
  return {
    cases: [caseData],
    current: caseData,
    progress,
    stage: 'investigate',
    finished: {},
    dispatch: vi.fn(),
    selectCase: vi.fn(),
    setStage: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
  };
}

const DEAD_END_TEXT = /必要な資料を開く調査予算が残っていません/;

describe('InvestigationScreen の詰み案内', () => {
  it('初期状態では案内を出さない', () => {
    render(<InvestigationScreen game={makeGame(makeProgress())} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('必要資料だけ開いた状態では案内を出さない', () => {
    render(<InvestigationScreen game={makeGame(makeProgress({ opened: ['a', 'b', 'c'] }))} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('外れ資料で予算を使い切って詰むと、やり直しの案内を出す', () => {
    // budget 3、外れ資料 d（コスト 2）を開くと必要資料 a,b,c（合計 3）が揃えられない
    render(<InvestigationScreen game={makeGame(makeProgress({ opened: ['d'] }))} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(DEAD_END_TEXT);
    expect(status).toHaveTextContent('この事件を最初からやり直してください');
  });

  it('案内内のボタンは既存の確認フローを経てリセットする', () => {
    const game = makeGame(makeProgress({ opened: ['d'] }));
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<InvestigationScreen game={game} />);
    const button = screen.getByRole('button', { name: 'この事件を最初からやり直す' });

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(button);
    expect(game.dispatch).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(button);
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'reset' });
    confirmSpy.mockRestore();
  });
});
