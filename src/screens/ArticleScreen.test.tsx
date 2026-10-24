import { fireEvent, render, screen } from '@testing-library/react';
import { ArticleScreen } from './ArticleScreen';
import { reduceProgress } from '../domain/game';
import type { GameApi } from '../state/useGame';
import type { CaseProgress } from '../domain/types';
import { makeCase, makeProgress } from '../test/fixtures';

const play = vi.fn();
vi.mock('../audio/useSound', () => ({ useSound: () => play }));

const caseData = makeCase();

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

const submitButton = () => screen.getByRole('button', { name: '記事を提出して評価を見る' });

beforeEach(() => play.mockClear());

describe('ArticleScreen', () => {
  it('提出前の確認に照合の問い（link_prompt）を表示する', () => {
    render(<ArticleScreen game={makeGame(makeProgress())} />);
    expect(screen.getByText(/この事件の照合/).closest('.notice')).toHaveTextContent(
      caseData.link_prompt,
    );
  });

  it('メーターと調査へ戻る導線を維持する', () => {
    const game = makeGame(makeProgress({ pinned: ['a', 'b'], calculations: { t1: '45', t2: '' } }));
    render(<ArticleScreen game={game} />);
    expect(screen.getByText(/採用証拠 2 件 \/ 検証メモ 1 件/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← 調査へ戻る' }));
    expect(game.setStage).toHaveBeenCalledWith('investigate');
  });

  it('断片が揃うまで提出ボタンは aria-disabled で理由を示し、押しても提出しない', () => {
    const game = makeGame(makeProgress({ article: ['f0'] }));
    render(<ArticleScreen game={game} />);
    const btn = submitButton();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).not.toBeDisabled();
    expect(screen.getByText('断片があと 2 個必要です。')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(game.dispatch).not.toHaveBeenCalledWith({ type: 'submit' });
    expect(play).not.toHaveBeenCalled();
  });

  it('3 断片揃えば提出でき、stamp の効果音を鳴らす', () => {
    const game = makeGame(makeProgress({ article: ['f0', 'f1', 'f2'] }));
    render(<ArticleScreen game={game} />);
    const btn = submitButton();
    expect(btn).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText(/断片があと/)).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(play).toHaveBeenCalledWith('stamp');
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'submit' });
  });

  it('編集操作がそれぞれの action として dispatch される', () => {
    const game = makeGame(makeProgress({ article: ['f0', 'f1'] }));
    render(<ArticleScreen game={game} />);
    fireEvent.click(screen.getByRole('button', { name: /^断片5/ }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'add-fragment', fragmentId: 'f5' });
    fireEvent.click(screen.getByRole('button', { name: '断片 1 を後ろへ' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'move-fragment', from: 0, to: 1 });
    fireEvent.click(screen.getByRole('button', { name: /^断片 2:/ }));
    fireEvent.click(screen.getByRole('button', { name: /^断片6/ }));
    expect(game.dispatch).toHaveBeenCalledWith({
      type: 'replace-fragment',
      index: 1,
      fragmentId: 'f6',
    });
    fireEvent.click(screen.getByRole('button', { name: '断片 1 を外す' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'remove-fragment', index: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'この見出しをクリア' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'clear-article' });
  });

  it('復元: 提出 → 差し戻し（withdraw）後も直前の 3 断片が画面に残り、再提出できる', () => {
    let p = makeProgress({ article: ['f3', 'f1', 'f2'] });
    p = reduceProgress(caseData, p, { type: 'submit' });
    p = reduceProgress(caseData, p, { type: 'withdraw' });
    const game = makeGame(p);
    render(<ArticleScreen game={game} />);
    expect(
      screen.getByRole('button', { name: '断片 1: 断片3（タップで差し替え）' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '断片 2: 断片1（タップで差し替え）' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '断片 3: 断片2（タップで差し替え）' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^断片3/ })).toHaveTextContent('使用中（断片 1）');
    fireEvent.click(submitButton());
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'submit' });
  });

  it('提出前は正誤を表示しない（誤った断片を置いても見た目は同じ）', () => {
    const { container } = render(
      <ArticleScreen game={makeGame(makeProgress({ article: ['f5', 'f6', 'f7'] }))} />,
    );
    expect(container.innerHTML).not.toMatch(/correct|incorrect|wrong-position|正解|不正解/);
  });

  it('提出済みの状態では理由に「提出済み」を示す', () => {
    render(
      <ArticleScreen
        game={makeGame(makeProgress({ article: ['f0', 'f1', 'f2'], published: true }))}
      />,
    );
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('この記事は提出済みです。')).toBeInTheDocument();
  });
});
