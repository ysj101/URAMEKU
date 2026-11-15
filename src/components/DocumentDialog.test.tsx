import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DocumentDialog } from './DocumentDialog';
import type { CaseProgress } from '../domain/types';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase({
  documents: [
    { id: 'a', title: '資料A', content: '1行目\n  2行目（空白つき）', cost: 1, visual: 'ledger' },
    { id: 'b', title: '資料B', content: 'x', cost: 1, visual: 'receipt' },
  ],
});

/** 親画面の最小再現: タイルで開き、onClose で閉じる */
function Harness({ progress }: { progress: CaseProgress }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpenId('a')}>
        タイルA
      </button>
      <button type="button" onClick={() => setOpenId('b')}>
        タイルB
      </button>
      <DocumentDialog
        caseData={caseData}
        progress={progress}
        documentId={openId}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

function dialogEl(): HTMLDialogElement {
  return document.querySelector('dialog') as HTMLDialogElement;
}

let pushState: ReturnType<typeof vi.spyOn>;
let back: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
  back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** history.back() の非同期な完了を、タイマーに頼らず明示する。 */
function finishBack() {
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });
}

function openA() {
  const tile = screen.getByRole('button', { name: 'タイルA' });
  tile.focus();
  fireEvent.click(tile);
  return tile;
}

describe('DocumentDialog', () => {
  it('タップで開き、見出しへフォーカスし、本文をテキストのまま表示する', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    expect(dialogEl().open).toBe(false);
    openA();
    expect(dialogEl().open).toBe(true);
    expect(screen.getByRole('heading', { name: '資料A' })).toHaveFocus();
    expect(document.getElementById('dialog-content')).toHaveTextContent('2行目（空白つき）');
    expect(document.getElementById('dialog-content')?.textContent).toBe(
      '1行目\n  2行目（空白つき）',
    );
    expect(pushState).toHaveBeenCalledWith({ doc: 'a' }, '');
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it('Esc（cancel）で閉じ、history.back で履歴を整合させ、元のタイルへフォーカスを戻す', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    const tile = openA();
    fireEvent(dialogEl(), new Event('cancel', { cancelable: true }));
    finishBack();
    expect(dialogEl().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(tile).toHaveFocus();
  });

  it('×ボタン・「資料を閉じる」で閉じる（history.back は 1 回だけ）', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    openA();
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    finishBack();
    expect(dialogEl().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);

    openA();
    fireEvent.click(screen.getByRole('button', { name: '資料を閉じる' }));
    finishBack();
    expect(dialogEl().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(2);
    expect(pushState).toHaveBeenCalledTimes(2);
  });

  it('背景タップで閉じる（本文内のタップでは閉じない）', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    openA();
    fireEvent.click(screen.getByRole('heading', { name: '資料A' }));
    expect(dialogEl().open).toBe(true);
    fireEvent.click(dialogEl());
    finishBack();
    expect(dialogEl().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('ブラウザの戻る（popstate）で閉じ、二重に history.back しない', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    openA();
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(dialogEl().open).toBe(false);
    expect(back).not.toHaveBeenCalled();
    // 閉じた後の popstate には反応しない
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(back).not.toHaveBeenCalled();
  });

  it('貼る操作はなく、読んだ資料はその旨を示して「資料を閉じる」で閉じる', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    openA();
    expect(
      screen.queryByRole('button', { name: /証拠ボードに貼る|ボードから外す/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'この資料は読んだので、記録の根拠として使えます。',
    );
    fireEvent.click(screen.getByRole('button', { name: '資料を閉じる' }));
    finishBack();
    expect(dialogEl().open).toBe(false);
  });
  it('履歴の戻りが完了するまで閉じる操作とフォーカス復帰を待ち、次の資料へ影響させない', () => {
    render(<Harness progress={makeProgress({ opened: ['a', 'b'] })} />);
    const tile = openA();
    fireEvent.click(screen.getByRole('button', { name: '資料を閉じる' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(dialogEl().open).toBe(true);
    expect(tile).not.toHaveFocus();
    // キーの繰り返しやEscが重なっても、履歴を二重に戻さない。
    fireEvent.keyDown(dialogEl(), { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(1);
    finishBack();
    expect(dialogEl().open).toBe(false);
    expect(tile).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'タイルB' }));
    expect(screen.getByRole('heading', { name: '資料B' })).toHaveFocus();
    expect(dialogEl().open).toBe(true);
  });

  it('直前のcloseイベントが遅れて届いても、新しく開いた資料を閉じない', () => {
    render(<Harness progress={makeProgress({ opened: ['a', 'b'] })} />);
    openA();
    fireEvent.click(screen.getByRole('button', { name: '資料を閉じる' }));
    finishBack();
    fireEvent.click(screen.getByRole('button', { name: 'タイルB' }));
    // HTMLDialogElement.close()のcloseイベントは別タスクで配送される。
    fireEvent(dialogEl(), new Event('close'));
    expect(dialogEl().open).toBe(true);
    expect(screen.getByRole('heading', { name: '資料B' })).toHaveFocus();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('ネイティブ側で閉じられた場合は履歴を戻し、タイルへフォーカスを戻す', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    const tile = openA();
    dialogEl().removeAttribute('open');
    fireEvent(dialogEl(), new Event('close'));
    expect(back).toHaveBeenCalledTimes(1);
    finishBack();
    expect(tile).toHaveFocus();
  });

  it('履歴を戻している途中のアンマウントで、さらに戻らない', () => {
    const { unmount } = render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    openA();
    fireEvent.click(screen.getByRole('button', { name: '資料を閉じる' }));
    unmount();
    expect(back).toHaveBeenCalledTimes(1);
  });
});
