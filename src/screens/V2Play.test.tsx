import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createProgress, reduceProgress } from '../domain/game';
import type { CaseData } from '../domain/types';
import { CASES } from '../data/cases';
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
  it('自由文を書かなくても提出でき、任意の補足は保持される', () => {
    render(<Harness data={makeV2Case()} />);
    expect(screen.queryByRole('heading', { name: '数値検証メモ' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '調査報告をまとめる →' }));
    const submit = screen.getByRole('button', { name: '報告を提出して振り返る' });
    expect(submit).not.toHaveAttribute('aria-disabled');
    // 骨子は記録から自動で組み立てられ、未記録の問いもそのまま見える
    expect(screen.getByRole('region', { name: '報告に含まれる記録' })).toHaveTextContent(
      '主張の対象範囲を確認してください。',
    );
    expect(screen.getByText('まだ関係を記録していません。')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '確認できたこと・採る方針' }), {
      target: { value: '対象を限定して報告する。' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: '未確認の点・前提・まだ決めきれないこと' }),
      {
        target: { value: '資料にない因果関係は保留する。' },
      },
    );
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
    // 答えだけでは完了にせず、参照資料の採用が必要なことを見出しで示す
    expect(screen.getByText('問 1 ・ 回答済み ・ まだ読んでいない資料 2 件')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('まだ読んでいない資料があります');
    // 畳むと選択肢は消え、選んだ答えが見出しに残る
    fireEvent.click(screen.getByRole('button', { name: /閉じる/ }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(group).toHaveTextContent('→ 確認した対象に限られる');
    // 参照資料が未採用のうちは「資料を確認」と促す
    fireEvent.click(screen.getByRole('button', { name: /資料を確認/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /^資料の関係0/ }));
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

describe('最初の事件の操作案内', () => {
  it('資料を読み、問1を記録すると案内と残りの一覧が進む', () => {
    const data = CASES[0]!;
    render(<Harness data={data} />);
    const guide = screen.getByRole('region', { name: '最初の事件で、遊び方を体験しよう' });
    fireEvent.click(within(guide).getByRole('button', { name: 'キャンペーン広告を開く' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(data.documents[0]!.content);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /戻る/ }));
    fireEvent.click(within(guide).getByRole('button', { name: '問1を開く' }));
    const task = data.v2!.decoding[0]!;
    const option = task.options.find((entry) => entry.id === 'paid_cohort')!;
    fireEvent.click(screen.getByRole('radio', { name: option.text }));
    const remaining = screen.getByRole('region', { name: '残っていること' });
    expect(remaining).toHaveTextContent('答えは記録済み。まだ読んでいない資料：');
    for (const id of option.evidence) {
      const doc = data.documents.find((entry) => entry.id === id)!;
      if (id === data.documents[0]!.id) continue;
      fireEvent.click(within(remaining).getAllByRole('button', { name: `${doc.title}を開く` })[0]!);
      expect(screen.getByRole('dialog')).toHaveTextContent(doc.content);
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /戻る/ }));
    }
    expect(guide).toHaveTextContent('問1の回答と資料確認ができました。');
    expect(
      within(remaining).queryByRole('button', { name: `問1：${task.prompt}` }),
    ).not.toBeInTheDocument();
    const next = data.v2!.decoding[1]!;
    fireEvent.click(within(remaining).getByRole('button', { name: `問2：${next.prompt}` }));
    expect(screen.getByRole('radio', { name: next.options[0]!.text })).toBeVisible();
    const boardTask = data.v2!.board!.tasks.at(-1)!;
    fireEvent.click(
      within(remaining).getByRole('button', {
        name: `証拠ボード：${boardTask.title}（まだ記録していません）`,
      }),
    );
    expect(
      screen.getByRole('button', { name: new RegExp(boardTask.title), pressed: true }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '調査報告をまとめる →' }));
    expect(screen.getByRole('complementary', { name: '初めての報告' })).toHaveTextContent(
      '補足の文章は書かなくても提出できます。',
    );
    fireEvent.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
    expect(screen.getByRole('button', { name: '報告を提出して振り返る' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
