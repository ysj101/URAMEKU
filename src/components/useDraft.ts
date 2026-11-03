import { useCallback, useState } from 'react';

const PREFIX = 'urameku:draft:';

function read<T>(key: string): T | undefined {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write<T>(key: string, value: T | undefined) {
  try {
    if (value === undefined) window.sessionStorage.removeItem(PREFIX + key);
    else window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* プライベートモード等で保存できなくても画面は動く */
  }
}

/**
 * 記録ボタンを押す前の入力（下書き）を sessionStorage に残すフック。
 * タブを切り替えたり画面を離れたりしても、同じタブ（ブラウザ）の中なら続きから書ける。
 * 記録したら `clear()` で消して初期値に戻す。記録した内容をそのまま画面に残すなら `forget()`
 * （保存先だけ消し、今の値は保つ）。
 */
export function useDraft<T>(
  key: string,
  initial: () => T,
): [T, (next: T | ((prev: T) => T)) => void, () => void, () => void] {
  const [value, setValue] = useState<T>(() => read<T>(key) ?? initial());
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  const clear = useCallback(() => {
    write(key, undefined);
    setValue(initial());
  }, [key, initial]);
  const forget = useCallback(() => write(key, undefined), [key]);
  return [value, set, clear, forget];
}
