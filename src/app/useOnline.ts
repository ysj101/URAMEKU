import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

function getSnapshot(): boolean {
  // navigator.onLine が無い環境（古い WebView など）は接続ありとみなす
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * ブラウザの接続状態（MVP-028）。
 * `navigator.onLine` を初期値とし、`online` / `offline` イベントで更新する。
 * ゲーム本体は端末内で完結するため、false でも操作は止めない（表示の注意喚起にだけ使う）。
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

let onlineEpoch = 0;

function subscribeEpoch(onChange: () => void): () => void {
  const handle = () => {
    onlineEpoch += 1;
    onChange();
  };
  window.addEventListener('online', handle);
  return () => window.removeEventListener('online', handle);
}

/**
 * 接続が戻るたびに増える番号。
 * 「オフライン表示を閉じたが、再びオフラインになったら出し直す」判定に使う
 * （閉じた時点の番号と現在の番号が違えば、間に一度オンラインになっている）。
 */
export function useOnlineEpoch(): number {
  return useSyncExternalStore(
    subscribeEpoch,
    () => onlineEpoch,
    () => 0,
  );
}
