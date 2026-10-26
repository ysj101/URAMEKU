import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createProgress, reduceProgress } from '../domain/game';
import type { CaseData } from '../domain/types';
import { makeV2Case } from '../test/v2Fixtures';
import type { GameApi } from '../state/useGame';
import { V2InvestigationScreen } from './V2InvestigationScreen';
import { V2ArticleScreen } from './V2ArticleScreen';

function Harness({ data }: { data: CaseData }) {
  const [progress, setProgress] = useState(() => createProgress(data));
  const [stage, setStage] = useState<'investigate' | 'article'>('investigate');
  const game: GameApi = {
    cases: [data],
    current: data,
    progress,
    stage,
    finished: {},
    setStage,
    dispatch: (action) => setProgress((p) => reduceProgress(data, p, action)),
    selectCase: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
  };
  return stage === 'article' ? (
    <V2ArticleScreen game={game} />
  ) : (
    <V2InvestigationScreen game={game} />
  );
}

describe('V2プレイの統合', () => {
  it('計算欄を要求せず報告と留保を編集して提出できる', () => {
    render(<Harness data={makeV2Case()} />);
    expect(screen.queryByRole('heading', { name: '数値検証メモ' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '調査報告をまとめる →' }));
    const submit = screen.getByRole('button', { name: '報告を提出して振り返る' });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    fireEvent.change(screen.getByRole('textbox', { name: '確認できたこと・採る方針' }), {
      target: { value: '対象を限定して報告する。' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '未確認の点・判断の前提や留保' }), {
      target: { value: '資料にない因果関係は保留する。' },
    });
    expect(submit).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByRole('button', { name: '← 調査へ戻る' }));
    fireEvent.click(screen.getByRole('button', { name: '調査報告をまとめる →' }));
    expect(screen.getByRole('textbox', { name: '確認できたこと・採る方針' })).toHaveValue(
      '対象を限定して報告する。',
    );
  });

  it('実験では初回判断を記録してから資料と解読メモを表示する', () => {
    render(<Harness data={makeV2Case(['decoding', 'experiment'])} />);
    expect(screen.queryByRole('heading', { name: /調査資料/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '情報解読メモ' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '判断を保留する' }));
    expect(screen.getByRole('heading', { name: /調査資料/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '情報解読メモ' })).toBeInTheDocument();
  });

  it('未開示資料を押しても本文をダイアログへ漏らさない', () => {
    render(<Harness data={makeV2Case(['decoding', 'decision'])} />);
    const tile = screen.getByRole('button', { name: /^資料C、未調査/ });
    expect(tile).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(tile);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByText('「資料C」は、最初の判断を記録すると開示されます。'),
    ).toBeInTheDocument();
  });
});
