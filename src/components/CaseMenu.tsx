import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { uiIcon } from '../data/assets';
import '../app/screens/case-menu.css';

export interface CaseMenuItem {
  id: string;
  /** 押した結果が分かる言葉（「遊び方を見る」のように動詞まで書く） */
  label: string;
  onSelect: () => void;
  /** やり直しなど、取り消せない操作。区切り線の下に置き、文字を警告色にする */
  danger?: boolean;
}

export interface CaseMenuProps {
  items: CaseMenuItem[];
  /** メニューを開くボタンの読み上げ名。既定は「メニュー」 */
  label?: string;
}

/**
 * 事件画面のヘッダー右に置く「⋯」メニュー。
 * 補助機能（遊び方、記録が未完のまま報告へ進む、やり直し）をまとめ、本流の操作と見た目を分ける。
 * - `aria-haspopup="menu"` / `role="menu"` / `menuitem`
 * - 上下の矢印キー、Home / End で移動、Esc と外側クリックで閉じる
 * - 危険な操作（`danger`）は区切り線の下に離して置く（UI 設計の基本 第 5 章）
 */
export function CaseMenu({ items, label = 'メニュー' }: CaseMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const safeItems = items.filter((item) => !item.danger);
  const dangerItems = items.filter((item) => item.danger);
  const ordered = [...safeItems, ...dangerItems];

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setFocusIndex(null);
    if (restoreFocus) buttonRef.current?.focus();
  };
  const openAt = (index: number) => {
    setOpen(true);
    setFocusIndex(index);
  };

  // 開いている間だけ、外側のクリックと Esc を見張る
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && focusIndex !== null) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAt(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(ordered.length - 1);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = ordered.length - 1;
    const current = focusIndex ?? 0;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusIndex(current >= last ? 0 : current + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIndex(current <= 0 ? last : current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setFocusIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setFocusIndex(last);
    } else if (event.key === 'Tab') {
      // Tab は次の部品へ進ませる。メニューは閉じる
      close(false);
    }
  };

  const select = (item: CaseMenuItem) => {
    close(false);
    item.onSelect();
  };

  const renderItem = (item: CaseMenuItem) => {
    const index = ordered.indexOf(item);
    return (
      <button
        key={item.id}
        ref={(el) => {
          itemRefs.current[index] = el;
        }}
        type="button"
        role="menuitem"
        className={item.danger ? 'case-menu__item is-danger' : 'case-menu__item'}
        tabIndex={focusIndex === index ? 0 : -1}
        onClick={() => select(item)}
        onFocus={() => setFocusIndex(index)}
      >
        {item.label}
      </button>
    );
  };

  return (
    <div className="case-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn ghost case-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onButtonKeyDown}
      >
        <img src={uiIcon('menu')} alt="" aria-hidden="true" className="case-menu__icon" />
        <span>{label}</span>
      </button>
      {open && (
        // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- フォーカスは中の menuitem が持つ
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="case-menu__list"
          onKeyDown={onMenuKeyDown}
        >
          {safeItems.map(renderItem)}
          {safeItems.length > 0 && dangerItems.length > 0 && (
            <hr className="case-menu__separator" />
          )}
          {dangerItems.map(renderItem)}
        </div>
      )}
    </div>
  );
}
