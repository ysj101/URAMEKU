import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createProgress } from '../domain/game';
import { makeV2Case } from '../test/v2Fixtures';
import type { GameApi } from '../state/useGame';
import type { Navigation } from '../app/navigation';
import { V2ResultScreen } from './V2ResultScreen';

function setup({ wrong = false, revealed = false } = {}) {
  const current = makeV2Case();
  const progress = createProgress(current);
  progress.opened = ['a', 'b'];
  progress.published = true;
  progress.revealed = revealed;
  progress.v2!.decoding = { scope: { optionId: wrong ? 'all' : 'limited', evidence: ['a', 'b'] } };
  progress.v2!.links = [{ from: 'a', to: 'b', relation: 'qualifies' }];
  progress.v2!.report = { claim: '対象を限定した報告', uncertainty: '原因は未確認' };
  const game: GameApi = {
    cases: [current],
    current,
    progress,
    stage: 'article',
    finished: {},
    dispatch: vi.fn(),
    setStage: vi.fn(),
    selectCase: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
  };
  const nav: Navigation = {
    route: { screen: 'play', caseId: current.id },
    navigate: vi.fn(),
    back: vi.fn(),
  };
  const view = render(<V2ResultScreen game={game} nav={nav} />);
  return { game, nav, ...view };
}

describe('V2の振り返り', () => {
  it('完了しても100点ランクや唯一の正解を出さず、解説は明示操作で開く', () => {
    const { game, rerender, nav } = setup();
    expect(
      screen.getByRole('heading', { name: '根拠と判断の記録をまとめました' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/100|評価ランク/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '資料に沿った解説' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '資料に沿った解説を開く' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'reveal' });
    rerender(
      <V2ResultScreen
        game={{ ...game, progress: { ...game.progress, revealed: true } }}
        nav={nav}
      />,
    );
    expect(screen.getByRole('heading', { name: '資料に沿った解説' })).toBeInTheDocument();
    expect(screen.getByTestId('case-disclaimer')).toHaveTextContent('架空');
  });

  it('事実誤認は根拠とともに解説し、調査に戻って修正できる', () => {
    const { game } = setup({ wrong: true, revealed: true });
    expect(screen.getByRole('heading', { name: 'まだ確認できる点があります' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '読み取りの確認' })).toHaveTextContent('資料A');
    fireEvent.click(screen.getByRole('button', { name: '調査・判断を見直す' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'withdraw' });
    expect(game.setStage).toHaveBeenCalledWith('investigate');
    expect(screen.queryByRole('button', { name: '次の事件へ' })).not.toBeInTheDocument();
  });
});
