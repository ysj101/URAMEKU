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

  it('解読タスクは1問ずつ開き、回答済みは選んだ答えを1行に畳む', () => {
    render(<Harness data={makeV2Case()} />);
    const group = screen.getByRole('group', { name: '主張の対象範囲を確認してください。' });
    fireEvent.click(screen.getByRole('radio', { name: '確認した対象に限られる' }));
    expect(screen.getByText('問 1 ・ 回答済み ・ 根拠 0 件')).toBeInTheDocument();
    // 畳むと選択肢は消え、選んだ答えが見出しに残る
    fireEvent.click(screen.getByRole('button', { name: /閉じる/ }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(group).toHaveTextContent('→ 確認した対象に限られる');
    fireEvent.click(screen.getByRole('button', { name: /変更する/ }));
    expect(screen.getByRole('radio', { name: '確認した対象に限られる' })).toBeChecked();
  });

  it('デスクはタブで切り替わり、進捗ストリップから証拠ボードへ移れる', () => {
    render(<Harness data={makeV2Case(['decoding', 'decision'])} />);
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['情報解読メモ0 / 1', '証拠ボード0 件', '意思決定未完了']);
    expect(screen.getByRole('tab', { name: /情報解読メモ/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('group', { name: '証拠ボード' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /資料の関係/ }));
    expect(screen.getByRole('group', { name: '証拠ボード' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /証拠ボード/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: /意思決定/ }));
    expect(screen.getByRole('region', { name: '意思決定シミュレーション' })).toBeInTheDocument();
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
