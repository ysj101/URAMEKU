// jsdom には AnimationEvent が無く、React DOM は読み込み時に存在を見て
// 購読するイベント名を決めるため、import より前に定義しておく（PaperCard.test と同じ）。
vi.hoisted(() => {
  if (!('AnimationEvent' in window)) {
    (window as unknown as { AnimationEvent: typeof Event }).AnimationEvent = class extends Event {};
  }
});

const playMock = vi.hoisted(() => vi.fn());
vi.mock('../audio/useSound', () => ({ useSound: () => playMock }));

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { EvidenceBoard } from './EvidenceBoard';
import { reduceProgress, type GameAction } from '../domain/game';
import type { CaseProgress } from '../domain/types';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase();

/** 実際の reducer を通して状態を更新するハーネス（画面と同じ配線） */
function Harness({ initial }: { initial: CaseProgress }) {
  const [progress, setProgress] = useState(initial);
  const dispatch = (action: GameAction) =>
    setProgress((prev) => reduceProgress(caseData, prev, action));
  return (
    <EvidenceBoard
      caseData={caseData}
      progress={progress}
      onToggleLink={(documentId) => dispatch({ type: 'toggle-link', documentId })}
      onUnpin={(documentId) => dispatch({ type: 'toggle-pin', documentId })}
    />
  );
}

const pinnedThree = () => makeProgress({ opened: ['a', 'b', 'c'], pinned: ['a', 'b', 'c'] });

const card = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}、`) });
const removeButton = (title: string) =>
  screen.getByRole('button', { name: `${title} をボードから外す` });
const statusText = () => screen.getByTestId('link-status').textContent ?? '';

beforeEach(() => playMock.mockClear());

describe('EvidenceBoard: タップ照合', () => {
  it('採用済みの資料がピンカードとして並び、ボードはグループとして読み上げられる', () => {
    render(<Harness initial={pinnedThree()} />);
    const board = screen.getByRole('group', { name: '証拠ボード' });
    expect(within(board).getAllByRole('listitem')).toHaveLength(3);
    expect(card('資料A')).toHaveAttribute('aria-pressed', 'false');
    expect(card('資料A')).toHaveAccessibleName('資料A、未選択');
  });

  it('この事件の照合の問い（link_prompt）を常に表示する', () => {
    render(<Harness initial={makeProgress()} />);
    expect(screen.getByTestId('link-prompt')).toHaveTextContent(caseData.link_prompt);
  });

  it('未採用なら案内文だけを出す', () => {
    render(<Harness initial={makeProgress()} />);
    expect(screen.getByText(/「証拠ボードに貼る」を押すとここに追加されます/)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('1 枚押すと選択中（A）、2 枚目で照合候補（A ↔ B）になり線で結ばれる', () => {
    render(<Harness initial={pinnedThree()} />);
    expect(screen.queryByTestId('link-thread')).not.toBeInTheDocument();

    fireEvent.click(card('資料A'));
    expect(card('資料A')).toHaveAttribute('aria-pressed', 'true');
    expect(card('資料A')).toHaveAccessibleName('資料A、選択中（A）');
    expect(statusText()).toContain('選択中（A）：資料A');
    expect(playMock).toHaveBeenLastCalledWith('ui-tap');

    fireEvent.click(card('資料C'));
    expect(card('資料C')).toHaveAttribute('aria-pressed', 'true');
    expect(card('資料C')).toHaveAccessibleName('資料C、照合候補（B）');
    expect(statusText()).toContain('照合候補（A ↔ B）：資料A ↔ 資料C');
    expect(screen.getByTestId('link-thread').querySelector('line')).toBeInTheDocument();
    expect(playMock).toHaveBeenLastCalledWith('evidence-link');
  });

  it('3 枚目を押すとその 1 枚から選び直す', () => {
    render(<Harness initial={pinnedThree()} />);
    fireEvent.click(card('資料A'));
    fireEvent.click(card('資料B'));
    fireEvent.click(card('資料C'));
    expect(card('資料A')).toHaveAttribute('aria-pressed', 'false');
    expect(card('資料B')).toHaveAttribute('aria-pressed', 'false');
    expect(card('資料C')).toHaveAttribute('aria-pressed', 'true');
    expect(card('資料C')).toHaveAccessibleName('資料C、選択中（A）');
    expect(screen.queryByTestId('link-thread')).not.toBeInTheDocument();
  });

  it('同じカードを再び押すと解除される', () => {
    render(<Harness initial={pinnedThree()} />);
    fireEvent.click(card('資料A'));
    fireEvent.click(card('資料A'));
    expect(card('資料A')).toHaveAttribute('aria-pressed', 'false');
    expect(statusText()).toContain('カードを 2 枚順に押して照合します');
  });

  it('ボードから外すとカードが消え、照合の選択も解除される', () => {
    render(<Harness initial={pinnedThree()} />);
    fireEvent.click(card('資料A'));
    fireEvent.click(card('資料B'));
    fireEvent.click(removeButton('資料A'));
    expect(screen.queryByRole('button', { name: /^資料A、/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    // 残った B が繰り上がって A になり、2 枚目は空になる
    expect(card('資料B')).toHaveAccessibleName('資料B、選択中（A）');
    expect(statusText()).toContain('資料B ↔ ［資料Bを選択］');
    expect(screen.queryByTestId('link-thread')).not.toBeInTheDocument();
  });

  it('提出済みなら選択も外すこともできず、理由を表示する', () => {
    const onToggleLink = vi.fn();
    const onUnpin = vi.fn();
    render(
      <EvidenceBoard
        caseData={caseData}
        progress={makeProgress({
          opened: ['a', 'b', 'c'],
          pinned: ['a', 'b', 'c'],
          chosenLink: ['a', 'c'],
          published: true,
        })}
        onToggleLink={onToggleLink}
        onUnpin={onUnpin}
      />,
    );
    const a = card('資料A');
    expect(a).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(a);
    fireEvent.click(card('資料B'));
    fireEvent.click(removeButton('資料A'));
    fireEvent.keyDown(a, { key: 'Delete' });
    expect(onToggleLink).not.toHaveBeenCalled();
    expect(onUnpin).not.toHaveBeenCalled();
    expect(playMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/提出済みのため照合を変更できません/)).toHaveLength(3);
    expect(removeButton('資料A')).toHaveAttribute('aria-disabled', 'true');
    // 提出済みでも選択中の 2 枚は表示され続ける
    expect(a).toHaveAttribute('aria-pressed', 'true');
    expect(card('資料C')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('EvidenceBoard: キーボード操作', () => {
  it('Tab でカードを移動し、Enter / Space で選択できる', async () => {
    const user = userEvent.setup();
    render(<Harness initial={pinnedThree()} />);
    await user.tab();
    expect(card('資料A')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(card('資料A')).toHaveAttribute('aria-pressed', 'true');

    await user.tab(); // 資料A の「外す」
    await user.tab(); // 資料B
    expect(card('資料B')).toHaveFocus();
    await user.keyboard(' ');
    expect(card('資料B')).toHaveAttribute('aria-pressed', 'true');
    expect(statusText()).toContain('照合候補（A ↔ B）：資料A ↔ 資料B');
  });

  it('Delete で確認なしにボードから外す', async () => {
    const user = userEvent.setup();
    render(<Harness initial={pinnedThree()} />);
    await user.tab();
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('button', { name: /^資料A、/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('EvidenceBoard: ネタバレ防止', () => {
  it.each([
    ['正解の組み合わせ', ['a', 'c']],
    ['不正解の組み合わせ', ['a', 'b']],
  ])('%s を選んでも正誤を画面に出さない', (_label, chosenLink) => {
    const { container } = render(
      <EvidenceBoard
        caseData={caseData}
        progress={makeProgress({ opened: ['a', 'b', 'c'], pinned: ['a', 'b', 'c'], chosenLink })}
        onToggleLink={vi.fn()}
        onUnpin={vi.fn()}
      />,
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/正解|不正解|correct|incorrect|成立|一致/);
    expect(container.querySelector('[data-link-status]')).toBeNull();
    expect(container.querySelector('[class*="correct"]')).toBeNull();
    expect(statusText()).toContain('照合候補（A ↔ B）');
  });

  it('正解と不正解で描画（クラス・属性の集合）が区別されない', () => {
    const signature = (chosenLink: string[]) => {
      const { container, unmount } = render(
        <EvidenceBoard
          caseData={caseData}
          progress={makeProgress({ opened: ['a', 'b', 'c'], pinned: ['a', 'b', 'c'], chosenLink })}
          onToggleLink={vi.fn()}
          onUnpin={vi.fn()}
        />,
      );
      const sig = Array.from(container.querySelectorAll('*'))
        .map((el) => {
          const attrs = Array.from(el.attributes)
            .filter((a) => !['data-document-id', 'aria-label', 'src'].includes(a.name))
            .map((a) => `${a.name}=${a.value}`)
            .sort()
            .join(' ');
          return `${el.tagName} ${attrs}`;
        })
        .sort()
        .join('\n');
      unmount();
      return sig;
    };
    expect(signature(['a', 'c'])).toBe(signature(['a', 'b']));
  });
});
