import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgress, reduceProgress, type GameAction } from '../domain/game';
import type { CaseData } from '../domain/types';
import { CASES } from '../data/cases';
import { makeV2Case } from '../test/v2Fixtures';
import type { GameApi } from '../state/useGame';
import type { Navigation } from '../app/navigation';
import { PlayScreen } from './PlayScreen';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function Harness({ data, actions = [] }: { data: CaseData; actions?: GameAction[] }) {
  const [progress, setProgress] = useState(() =>
    actions.reduce((record, action) => reduceProgress(data, record, action), createProgress(data)),
  );
  const [stage, setStage] = useState<'investigate' | 'article'>('investigate');
  const nav: Navigation = { route: { screen: 'play' }, navigate: vi.fn(), back: vi.fn() };
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
  return <PlayScreen game={game} nav={nav} />;
}

/** ヘッダーの「⋯」メニューを開いて項目を選ぶ */
function chooseMenuItem(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'メニュー' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
}
const PROCEED = '調査報告へ進む（記録が未完でも）';

describe('V2プレイの統合', () => {
  it('自由文を書かなくても提出でき、任意の補足は保持される', () => {
    render(<Harness data={makeV2Case()} />);
    expect(screen.queryByRole('heading', { name: '数値検証メモ' })).not.toBeInTheDocument();
    // 記録が未完のまま進む経路は、画面の帯ではなくヘッダーのメニューにある
    expect(screen.queryByRole('button', { name: '調査報告をまとめる →' })).not.toBeInTheDocument();
    chooseMenuItem(PROCEED);
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
    chooseMenuItem(PROCEED);
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
    // 1回目の選択は済んでいるので、タブは「未完了」ではなく回数で示す
    expect(screen.getByRole('tab', { name: /見え方のミニ実験/ })).toHaveTextContent('1 / 2');
  });

  it('解読タスクは1問ずつ開き、回答済みは選んだ答えを1行に畳む', () => {
    render(<Harness data={makeV2Case()} />);
    const group = screen.getByRole('group', { name: '主張の対象範囲を確認してください。' });
    fireEvent.click(screen.getByRole('radio', { name: '確認した対象に限られる' }));
    // 答えだけでは完了にせず、参照資料の採用が必要なことを見出しで示す
    expect(screen.getByText('問 1 ・ 回答済み ・ まだ読んでいない資料 2 件')).toBeInTheDocument();
    expect(within(group).getByRole('status')).toHaveTextContent('まだ読んでいない資料があります');
    // 畳むと選択肢は消え、選んだ答えが見出しに残る
    fireEvent.click(within(group).getByRole('button', { name: /閉じる/ }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(group).toHaveTextContent('→ 確認した対象に限られる');
    // 参照資料が未採用のうちは「資料を確認」と促す
    fireEvent.click(within(group).getByRole('button', { name: /資料を確認/ }));
    expect(screen.getByRole('radio', { name: '確認した対象に限られる' })).toBeChecked();
  });

  it('デスクのタブは矢印キーと Home / End で移動し、フォーカスも追従する', () => {
    render(<Harness data={makeV2Case(['decoding', 'decision'])} />);
    const decoding = screen.getByRole('tab', { name: /情報解読メモ/ });
    const board = screen.getByRole('tab', { name: /証拠ボード/ });
    const decision = screen.getByRole('tab', { name: /意思決定/ });
    decoding.focus();
    fireEvent.keyDown(decoding, { key: 'ArrowRight' });
    expect(board).toHaveAttribute('aria-selected', 'true');
    expect(board).toHaveFocus();
    expect(decoding).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(board, { key: 'End' });
    expect(decision).toHaveAttribute('aria-selected', 'true');
    expect(decision).toHaveFocus();
    fireEvent.keyDown(decision, { key: 'ArrowRight' });
    expect(decoding).toHaveAttribute('aria-selected', 'true');
    expect(decoding).toHaveFocus();
  });

  it('デスクはタブで切り替わり、証拠ボードへ移れる', () => {
    render(<Harness data={makeV2Case(['decoding', 'decision'])} />);
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['情報解読メモ0 / 1', '証拠ボード0 件', '意思決定未完了']);
    expect(screen.getByRole('tab', { name: /情報解読メモ/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('group', { name: '証拠ボード' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /証拠ボード/ }));
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
    const guide = screen.getByRole('region', { name: '次にやること' });
    fireEvent.click(within(guide).getByRole('button', { name: 'キャンペーン広告を開く' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(data.documents[0]!.content);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '資料を閉じる' }),
    );
    fireEvent.click(within(guide).getByRole('button', { name: '問1を開く' }));
    const task = data.v2!.decoding[0]!;
    const option = task.options.find((entry) => entry.id === 'paid_cohort')!;
    fireEvent.click(screen.getByRole('radio', { name: option.text }));
    fireEvent.click(screen.getByText('残っていることの一覧'));
    const remaining = screen.getByRole('region', { name: '残っていること' });
    expect(remaining).toHaveTextContent('答えは記録済み。まだ読んでいない資料：');
    for (const id of option.evidence) {
      const doc = data.documents.find((entry) => entry.id === id)!;
      if (id === data.documents[0]!.id) continue;
      expect(within(guide).getByRole('button', { name: `${doc.title}を開く` })).toHaveClass(
        'primary',
      );
      fireEvent.click(within(remaining).getAllByRole('button', { name: `${doc.title}を開く` })[0]!);
      expect(screen.getByRole('dialog')).toHaveTextContent(doc.content);
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: '資料を閉じる' }),
      );
    }
    expect(within(guide).getByRole('button', { name: '問2を開く' })).toHaveClass('primary');
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
    chooseMenuItem(PROCEED);
    expect(screen.getByRole('complementary', { name: '初めての報告' })).toHaveTextContent(
      '補足の文章は書かなくても提出できます。',
    );
    fireEvent.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
    // 提出すると結果画面に切り替わり、記事画面の提出ボタンは消える
    expect(
      screen.queryByRole('button', { name: '報告を提出して振り返る' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'メニュー' })).toBeInTheDocument();
  });
});

describe('ヘッダーのメニュー', () => {
  it('遊び方・報告へ進む・やり直しの順に並び、やり直しは区切り線の下に離す', () => {
    render(<Harness data={CASES[0]!} />);
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }));
    const menu = screen.getByRole('menu', { name: 'メニュー' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '遊び方を見る',
      PROCEED,
      'この事件を最初からやり直す',
    ]);
    expect(items[2]).toHaveClass('is-danger');
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
    // 記事の段階では「報告へ進む」は出さない
    fireEvent.click(within(menu).getByRole('menuitem', { name: PROCEED }));
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }));
    expect(screen.queryByRole('menuitem', { name: PROCEED })).not.toBeInTheDocument();
  });

  it('矢印キーで項目を移動し、Esc で閉じてボタンへ戻る', () => {
    render(<Harness data={CASES[0]!} />);
    const button = screen.getByRole('button', { name: 'メニュー' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const menu = screen.getByRole('menu', { name: 'メニュー' });
    const [guide, proceed, reset] = within(menu).getAllByRole('menuitem');
    expect(guide).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(proceed).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(reset).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(guide).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(reset).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('遊び方はメニューから開き、最初の事件の手順を示す', () => {
    render(<Harness data={CASES[0]!} />);
    expect(screen.queryByText('最初の事件で、遊び方を体験しよう')).not.toBeInTheDocument();
    chooseMenuItem('遊び方を見る');
    const guide = screen.getByRole('region', { name: '最初の事件で、遊び方を体験しよう' });
    expect(within(guide).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: '遊び方' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '遊び方を閉じる' }));
    expect(screen.queryByRole('region', { name: '遊び方' })).not.toBeInTheDocument();
  });

  it('やり直しは確認パネルを経て、記録と予算を最初に戻す', () => {
    const data = CASES[0]!;
    const paid = data.documents.find((doc) => doc.cost > 0)!;
    render(<Harness data={data} actions={[{ type: 'open-document', documentId: paid.id }]} />);
    expect(
      screen.getByText(`調査予算：残り ${data.budget - paid.cost} / ${data.budget}`),
    ).toBeVisible();
    chooseMenuItem('この事件を最初からやり直す');
    const confirm = screen.getByRole('alertdialog', { name: 'やり直しの確認' });
    expect(confirm).toHaveFocus();
    fireEvent.click(within(confirm).getByRole('button', { name: 'やめる' }));
    expect(
      screen.getByText(`調査予算：残り ${data.budget - paid.cost} / ${data.budget}`),
    ).toBeVisible();
    chooseMenuItem('この事件を最初からやり直す');
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: 'やり直しの確認' })).getByRole('button', {
        name: 'やり直す',
      }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(`調査予算：残り ${data.budget} / ${data.budget}`)).toBeVisible();
  });
});

function enabledPrimaries(container: HTMLElement) {
  return within(container)
    .getAllByRole('button')
    .filter((button) => button.classList.contains('primary') && !button.hasAttribute('disabled'));
}

describe('次の操作の強調', () => {
  it.each(CASES)('$id は各デスクで押せるprimaryを多くても1つに保つ', (data) => {
    const { container } = render(<Harness data={data} />);
    // 最初の判断が必要な事件では、選択肢そのものが画面に出ているのでカードは控えめにする。
    expect(enabledPrimaries(container)).toHaveLength(data.v2?.experiment ? 0 : 1);
    if (data.v2?.experiment) {
      fireEvent.click(screen.getByRole('button', { name: data.v2.experiment.choices[0]!.text }));
    }
    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.click(tab);
      expect(enabledPrimaries(container).length).toBeLessThanOrEqual(1);
    }
    // 記録が未完の間は報告ボタンを画面に出さず、メニューの中にだけ置く
    expect(screen.queryByRole('button', { name: '調査報告をまとめる →' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'メニュー' }));
    expect(screen.getByRole('menuitem', { name: PROCEED })).toBeInTheDocument();
  });

  it('問いとボードの記録がそろうと、報告だけを強調する', () => {
    const data = CASES[0]!;
    const board = data.v2!.board!;
    const actions: GameAction[] = [
      ...data.documents
        .slice(0, 4)
        .map((doc): GameAction => ({ type: 'open-document', documentId: doc.id })),
      ...data.v2!.decoding.map((task): GameAction => ({
        type: 'v2-decode',
        taskId: task.id,
        optionId: task.options.find((option) => option.accepted)!.id,
        evidence: [],
      })),
      ...board.tasks.map((task): GameAction => ({
        type: 'v2-board',
        taskId: task.id,
        record: {
          values: task.rules[0]!.values,
          evidence: task.rules[0]!.evidence,
          disposition: task.rules[0]!.disposition,
        },
      })),
    ];
    const { container } = render(<Harness data={data} actions={actions} />);
    expect(enabledPrimaries(container)).toHaveLength(1);
    expect(screen.getByRole('button', { name: '調査報告をまとめる →' })).toHaveClass('primary');
    // 完了は色だけでなく「完了」の文字でも分かる
    expect(screen.getByRole('tab', { name: /情報解読メモ/ })).toHaveTextContent(/完了$/);
    expect(screen.getByRole('tab', { name: /証拠ボード/ })).toHaveTextContent(/件 完了$/);
    fireEvent.click(screen.getByRole('tab', { name: /証拠ボード/ }));
    expect(enabledPrimaries(container)).toHaveLength(1);
    fireEvent.click(screen.getByText('残っていることの一覧'));
    expect(screen.getByRole('heading', { name: '残っていること' })).toBeVisible();
    expect(screen.getByRole('region', { name: '残っていること' })).toHaveTextContent(
      '記録はそろいました。',
    );
  });
});
