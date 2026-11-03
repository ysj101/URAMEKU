import { useRef, type KeyboardEvent } from 'react';

/**
 * role="tablist" のキーボード操作（WAI-ARIA の Tabs パターン）。
 * 左右・上下の矢印で隣のタブへ、Home / End で端へ移り、フォーカスも追従する。
 * 選ばれていないタブは tabIndex=-1 にして、Tab キー 1 回でパネルへ抜けられるようにする。
 *
 * 使い方: 各タブに `ref={tabRef(i)}` `tabIndex={tabIndex(i)}` `onKeyDown={(e) => onKeyDown(e, i)}` を付ける。
 */
export function useRovingTabs(
  count: number,
  selectedIndex: number,
  select: (index: number) => void,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % count;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };
  return {
    tabRef: (index: number) => (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    tabIndex: (index: number) => (index === selectedIndex ? 0 : -1),
    onKeyDown,
  };
}
