import { useSyncExternalStore } from 'react';
import { MOTION_ATTRIBUTE } from './motionSettings';

/**
 * 演出を減らすべきかを返すフック（MVP-038）。
 *
 * 次のどちらかが真なら true:
 *   - OS 設定 `matchMedia('(prefers-reduced-motion: reduce)')`
 *   - アプリ設定 `<html data-motion="reduced">`（motionSettings.ts が付ける）
 *
 * CSS 側（motion.css）は同じ条件で演出を止めるので、コンポーネントは本フックで
 * 「演出なしの最終状態を即時に出す」「animationend を待たない」分岐だけを書けばよい。
 * matchMedia や MutationObserver が無い環境（jsdom・SSR）では属性だけを見る。
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function mediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY);
  } catch {
    return null;
  }
}

/** フックを使わずに同期的に判定する（イベントハンドラやテスト用）。 */
export function readReducedMotion(): boolean {
  const byAttribute =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute(MOTION_ATTRIBUTE) === 'reduced';
  if (byAttribute) return true;
  return mediaQuery()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const mql = mediaQuery();
  mql?.addEventListener('change', onChange);

  let observer: MutationObserver | null = null;
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [MOTION_ATTRIBUTE],
    });
  }

  return () => {
    mql?.removeEventListener('change', onChange);
    observer?.disconnect();
  };
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readReducedMotion, getServerSnapshot);
}
