import type { StorageLike } from '../state/persistence';

/**
 * 演出量のアプリ内設定（MVP-038）。
 *
 * - 'system': OS の prefers-reduced-motion に従う（既定）
 * - 'reduced': OS 設定に関わらず演出を減らす
 *
 * 保存先は localStorage のキー `urameku-motion`（セーブデータとは別キー）。
 * 反映は `<html data-motion="reduced">` 属性で行い、motion.css と useReducedMotion がこれを見る。
 * 設定 UI からの呼び出しは UI 系 Issue で組み込む。起動時は `initMotionPreference()` を 1 回呼ぶ。
 */
export type MotionPreference = 'system' | 'reduced';

export const MOTION_STORAGE_KEY = 'urameku-motion';
export const MOTION_ATTRIBUTE = 'data-motion';

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function defaultRoot(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'reduced';
}

/** 保存値を読む。無い・壊れている・読めないときは 'system'。 */
export function loadMotionPreference(
  storage: StorageLike | null = defaultStorage(),
): MotionPreference {
  if (!storage) return 'system';
  try {
    const raw = storage.getItem(MOTION_STORAGE_KEY);
    return isMotionPreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

/** 設定を保存する。'system' はキーを削除する（既定値を保存しない）。保存失敗は握りつぶす。 */
export function saveMotionPreference(
  preference: MotionPreference,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    if (preference === 'system') storage.removeItem(MOTION_STORAGE_KEY);
    else storage.setItem(MOTION_STORAGE_KEY, preference);
  } catch {
    /* 容量超過・プライベートモードなど。設定は今セッション内だけ有効になる */
  }
}

/** `<html data-motion>` に反映する。'system' のときは属性を外す。 */
export function applyMotionPreference(
  preference: MotionPreference,
  root: HTMLElement | null = defaultRoot(),
): void {
  if (!root) return;
  if (preference === 'reduced') root.setAttribute(MOTION_ATTRIBUTE, 'reduced');
  else root.removeAttribute(MOTION_ATTRIBUTE);
}

/** 保存 → 反映をまとめて行う（設定 UI から使う）。 */
export function setMotionPreference(
  preference: MotionPreference,
  storage: StorageLike | null = defaultStorage(),
  root: HTMLElement | null = defaultRoot(),
): void {
  saveMotionPreference(preference, storage);
  applyMotionPreference(preference, root);
}

/** 起動時に保存値を読み、属性に反映して返す。 */
export function initMotionPreference(
  storage: StorageLike | null = defaultStorage(),
  root: HTMLElement | null = defaultRoot(),
): MotionPreference {
  const preference = loadMotionPreference(storage);
  applyMotionPreference(preference, root);
  return preference;
}
