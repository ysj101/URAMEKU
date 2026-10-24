import { useCallback, useState } from 'react';
import type { StorageLike } from './persistence';

/**
 * チュートリアルの進行状態（MVP-021）。
 *
 * - completed: 遊び方画面を最後まで見た（またはスキップした）か
 * - hintsEnabled: プレイ画面の段階ヒント（TutorialHint）を表示するか
 *
 * 保存先は localStorage のキー `urameku-tutorial`（セーブデータとは別キー）。
 * `urameku-` 接頭辞なので「この端末の記録を削除」（wipe.ts）でまとめて消える。
 * 読めない・壊れている場合は既定値（未完了・ヒント表示）に戻す。
 */
export interface TutorialState {
  completed: boolean;
  hintsEnabled: boolean;
}

export const TUTORIAL_STORAGE_KEY = 'urameku-tutorial';

export const DEFAULT_TUTORIAL_STATE: TutorialState = { completed: false, hintsEnabled: true };

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 保存値を読む。無い・壊れている・読めないときは既定値。欠けた項目は既定値で補う。 */
export function loadTutorialState(storage: StorageLike | null = defaultStorage()): TutorialState {
  if (!storage) return { ...DEFAULT_TUTORIAL_STATE };
  try {
    const raw = storage.getItem(TUTORIAL_STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_TUTORIAL_STATE };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...DEFAULT_TUTORIAL_STATE };
    return {
      completed:
        typeof parsed.completed === 'boolean' ? parsed.completed : DEFAULT_TUTORIAL_STATE.completed,
      hintsEnabled:
        typeof parsed.hintsEnabled === 'boolean'
          ? parsed.hintsEnabled
          : DEFAULT_TUTORIAL_STATE.hintsEnabled,
    };
  } catch {
    return { ...DEFAULT_TUTORIAL_STATE };
  }
}

/** 状態を保存する。保存失敗（容量超過・プライベートモード等）は握りつぶす。 */
export function saveTutorialState(
  state: TutorialState,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 今セッション内だけ有効になる */
  }
}

/** 段階ヒントを出すべきか。閉じられるまでは常に出す（初回プレイの補助）。 */
export function shouldShowHints(state: TutorialState): boolean {
  return state.hintsEnabled;
}

/**
 * React 用。読み込みは初回描画時に 1 回、更新は保存と同時に行う。
 * `storage` はテスト用の差し替え口（省略時は localStorage）。
 */
export function useTutorialState(storage: StorageLike | null = defaultStorage()) {
  const [state, setState] = useState<TutorialState>(() => loadTutorialState(storage));

  const update = useCallback(
    (patch: Partial<TutorialState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        saveTutorialState(next, storage);
        return next;
      });
    },
    [storage],
  );

  const markCompleted = useCallback(() => update({ completed: true }), [update]);
  const disableHints = useCallback(() => update({ hintsEnabled: false }), [update]);
  const enableHints = useCallback(() => update({ hintsEnabled: true }), [update]);

  return { state, markCompleted, disableHints, enableHints };
}
