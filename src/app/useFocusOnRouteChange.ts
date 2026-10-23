import { useEffect, useRef, useState } from 'react';

/**
 * 画面遷移時のフォーカス管理と読み上げ告知（MVP-039）。
 *
 * `key` が変わるたび（ハッシュ遷移、調査→記事→結果の段階切替）に、
 * `main` 内の次の優先順でフォーカスを移す。
 *   1. `[data-focus-target]`（画面内の段階見出しなど、画面が明示した要素）
 *   2. `h1`
 *   3. `main` 自体
 * フォーカス先が focusable でなければ `tabindex="-1"` を付けてから focus する。
 * 初回マウントではフォーカスを動かさない（ページ先頭のスキップリンクを最初の Tab 先に残すため）。
 *
 * 戻り値は `aria-live="polite"` 領域に出す画面名。`h1` の文言に、フォーカス先が別要素なら
 * その文言を続ける（例: 「半額セールの値札、STEP 02 / 記事を組み立てる」）。
 */
export const FOCUS_TARGET_ATTR = 'data-focus-target';

function textOf(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** `main` 内からフォーカス先を選ぶ（純粋関数。テストしやすいよう公開） */
export function pickFocusTarget(main: HTMLElement): HTMLElement {
  const explicit = main.querySelector<HTMLElement>(`[${FOCUS_TARGET_ATTR}]`);
  if (explicit) return explicit;
  const h1 = main.querySelector<HTMLElement>('h1');
  if (h1) return h1;
  return main;
}

/** 告知文: h1 の文言 + （フォーカス先が h1 以外なら）その文言 */
export function announcementFor(main: HTMLElement, target: HTMLElement): string {
  const h1 = main.querySelector<HTMLElement>('h1');
  const parts: string[] = [];
  if (h1) parts.push(textOf(h1));
  if (target !== h1) {
    const t = textOf(target);
    if (t && t !== parts[0]) parts.push(t);
  }
  return parts.filter(Boolean).join('、');
}

export function focusElement(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: false });
}

export function useFocusOnRouteChange(key: string, mainId = 'workbench'): string {
  const [announcement, setAnnouncement] = useState('');
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const main = document.getElementById(mainId);
    if (!main) return;
    const target = pickFocusTarget(main);
    focusElement(target);
    // 告知文はコミット後の DOM（h1 とフォーカス先）から決まるため、effect 内で確定させる
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnnouncement(announcementFor(main, target));
  }, [key, mainId]);

  return announcement;
}
