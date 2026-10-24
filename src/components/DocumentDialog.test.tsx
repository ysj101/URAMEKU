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
function Harness({
  progress,
  onTogglePin,
}: {
  progress: CaseProgress;
  onTogglePin?: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpenId('a')}>
        タイルA
      </button>
      <DocumentDialog
        caseData={caseData}
        progress={progress}
        documentId={openId}
        onTogglePin={(id) => {
          onTogglePin?.(id);
          setOpenId(null);
        }}
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
    expect(dialogEl().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
    expect(tile).toHaveFocus();
  });

  it('閉じるボタン・戻るボタンで閉じる（history.back は 1 回だけ）', () => {
    render(<Harness progress={makeProgress({ opened: ['a'] })} />);
    openA();
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(dialogEl().open).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);

    openA();
    fireEvent.click(screen.getByRole('button', { name: '戻る' }));
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

  it('ピン操作で onTogglePin が呼ばれる（閲覧済み）', () => {
    const onTogglePin = vi.fn();
    render(<Harness progress={makeProgress({ opened: ['a'] })} onTogglePin={onTogglePin} />);
    openA();
    const pin = screen.getByRole('button', { name: '証拠ボードに貼る' });
    expect(pin).not.toHaveAttribute('aria-disabled');
    fireEvent.click(pin);
    expect(onTogglePin).toHaveBeenCalledWith('a');
    expect(dialogEl().open).toBe(false);
  });

  it('採用済みなら「外す」になる', () => {
    const onTogglePin = vi.fn();
    render(
      <Harness
        progress={makeProgress({ opened: ['a'], pinned: ['a'] })}
        onTogglePin={onTogglePin}
      />,
    );
    openA();
    fireEvent.click(screen.getByRole('button', { name: 'ボードから外す' }));
    expect(onTogglePin).toHaveBeenCalledWith('a');
  });

  it('提出済みはピン操作を無効化し理由を表示する', () => {
    const onTogglePin = vi.fn();
    render(
      <Harness
        progress={makeProgress({ opened: ['a'], pinned: ['a'], published: true })}
        onTogglePin={onTogglePin}
      />,
    );
    openA();
    const pin = screen.getByRole('button', { name: 'ボードから外す' });
    expect(pin).toHaveAttribute('aria-disabled', 'true');
    expect(pin).toHaveAccessibleDescription(/提出済み/);
    fireEvent.click(pin);
    expect(onTogglePin).not.toHaveBeenCalled();
  });
});
