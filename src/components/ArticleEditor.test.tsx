import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ArticleEditor } from './ArticleEditor';
import { reduceProgress } from '../domain/game';
import type { CaseProgress } from '../domain/types';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase({
  headline_fragments: Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, text: `断片${i}` })),
  correct_fragments: ['f0', 'f1', 'f2'],
});

/** reducer に接続した状態で編集を再現する（状態整合の確認用） */
function Harness({ initial }: { initial: CaseProgress }) {
  const [progress, setProgress] = useState(initial);
  const d = (action: Parameters<typeof reduceProgress>[2]) =>
    setProgress((p) => reduceProgress(caseData, p, action));
  return (
    <>
      <ArticleEditor
        caseData={caseData}
        progress={progress}
        onAdd={(fragmentId) => d({ type: 'add-fragment', fragmentId })}
        onRemove={(index) => d({ type: 'remove-fragment', index })}
        onReplace={(index, fragmentId) => d({ type: 'replace-fragment', index, fragmentId })}
        onMove={(from, to) => d({ type: 'move-fragment', from, to })}
        onClear={() => d({ type: 'clear-article' })}
      />
      <div data-testid="article">{progress.article.join(',')}</div>
    </>
  );
}

const article = () => screen.getByTestId('article').textContent ?? '';
const fragment = (n: number) => screen.getByRole('button', { name: new RegExp(`^断片${n}`) });
const slot = (n: number) => screen.getByRole('button', { name: new RegExp(`^断片 ${n}[:（]`) });

describe('ArticleEditor', () => {
  it('追加: 断片をタップすると順に埋まり、使用中の断片は一覧に残る', () => {
    render(<Harness initial={makeProgress()} />);
    fireEvent.click(fragment(3));
    fireEvent.click(fragment(0));
    expect(article()).toBe('f3,f0');
    expect(fragment(3)).toHaveAttribute('aria-disabled', 'true');
    expect(fragment(3)).toHaveTextContent('使用中（断片 1）');
    expect(fragment(0)).toHaveTextContent('使用中（断片 2）');
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('重複不可: 使用中の断片をもう一度タップしても追加されない', () => {
    render(<Harness initial={makeProgress({ article: ['f3'] })} />);
    fireEvent.click(fragment(3));
    expect(article()).toBe('f3');
  });

  it('3 つ超えは不可: 揃った後は未使用の断片が aria-disabled になる', () => {
    render(<Harness initial={makeProgress({ article: ['f0', 'f1', 'f2'] })} />);
    expect(fragment(5)).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(fragment(5));
    expect(article()).toBe('f0,f1,f2');
    expect(screen.getByRole('status')).toHaveTextContent('3 つ揃いました');
  });

  it('差し替え: スロットをタップしてから断片を選ぶとそのスロットが置き換わる', () => {
    render(<Harness initial={makeProgress({ article: ['f0', 'f1', 'f2'] })} />);
    fireEvent.click(slot(2));
    expect(slot(2)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('断片 2 を差し替えます');
    expect(fragment(5)).not.toHaveAttribute('aria-disabled');
    fireEvent.click(fragment(5));
    expect(article()).toBe('f0,f5,f2');
    // 差し替え後はモード解除
    expect(slot(2)).toHaveAttribute('aria-pressed', 'false');
    // 外れた f1 は「使用中」ではなくなる（3 つ揃っているので未使用として aria-disabled のまま）
    expect(fragment(1)).not.toHaveTextContent('使用中');
    expect(fragment(1)).toHaveAttribute('aria-disabled', 'true');
  });

  it('差し替えモード中でも使用中の断片は選べず、スロット再タップで解除できる', () => {
    render(<Harness initial={makeProgress({ article: ['f0', 'f1', 'f2'] })} />);
    fireEvent.click(slot(1));
    fireEvent.click(fragment(2));
    expect(article()).toBe('f0,f1,f2');
    fireEvent.click(slot(1));
    expect(slot(1)).toHaveAttribute('aria-pressed', 'false');
  });

  it('入れ替え: ↑↓ で順序を変え、端では押せない', () => {
    render(<Harness initial={makeProgress({ article: ['f0', 'f1', 'f2'] })} />);
    expect(screen.getByRole('button', { name: '断片 1 を前へ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '断片 3 を後ろへ' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '断片 1 を後ろへ' }));
    expect(article()).toBe('f1,f0,f2');
    fireEvent.click(screen.getByRole('button', { name: '断片 3 を前へ' }));
    expect(article()).toBe('f1,f2,f0');
  });

  it('外す: スロットの断片を戻すと一覧の「使用中」が消える', () => {
    render(<Harness initial={makeProgress({ article: ['f0', 'f1', 'f2'] })} />);
    fireEvent.click(screen.getByRole('button', { name: '断片 2 を外す' }));
    expect(article()).toBe('f0,f2');
    expect(fragment(1)).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('status')).toHaveTextContent('あと 1 個');
  });

  it('クリア: 3 スロットを空にする（空のときは何もしない）', () => {
    render(<Harness initial={makeProgress({ article: ['f0', 'f1', 'f2'] })} />);
    const clear = screen.getByRole('button', { name: 'この見出しをクリア' });
    expect(clear).not.toHaveAttribute('aria-disabled');
    fireEvent.click(clear);
    expect(article()).toBe('');
    expect(clear).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('あと 3 個');
  });

  it('提出前に正誤（correct / incorrect）を一切表示しない', () => {
    const { container } = render(
      <Harness initial={makeProgress({ article: ['f5', 'f1', 'f0'] })} />,
    );
    expect(container.innerHTML).not.toMatch(/correct|incorrect|wrong-position|正解|不正解|誤り/);
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).not.toMatch(/correct|incorrect|wrong/);
    }
  });

  it('複数回の操作を繰り返しても重複・4 つ目が発生しない', () => {
    render(<Harness initial={makeProgress()} />);
    for (const n of [4, 4, 5, 6, 7, 0]) fireEvent.click(fragment(n));
    expect(article()).toBe('f4,f5,f6');
    fireEvent.click(slot(3));
    fireEvent.click(fragment(0));
    fireEvent.click(screen.getByRole('button', { name: '断片 3 を前へ' }));
    fireEvent.click(screen.getByRole('button', { name: '断片 1 を外す' }));
    fireEvent.click(fragment(1));
    const ids = article().split(',');
    expect(ids).toEqual(['f0', 'f5', 'f1']);
    expect(new Set(ids).size).toBe(3);
  });
});
