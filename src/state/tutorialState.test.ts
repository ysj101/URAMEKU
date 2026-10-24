import { act, renderHook } from '@testing-library/react';
import {
  DEFAULT_TUTORIAL_STATE,
  TUTORIAL_STORAGE_KEY,
  loadTutorialState,
  saveTutorialState,
  shouldShowHints,
  useTutorialState,
} from './tutorialState';
import type { StorageLike } from './persistence';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('tutorialState', () => {
  it('保存が無ければ既定値（未完了・ヒント表示）', () => {
    expect(loadTutorialState(memoryStorage())).toEqual(DEFAULT_TUTORIAL_STATE);
    expect(loadTutorialState(null)).toEqual(DEFAULT_TUTORIAL_STATE);
    expect(shouldShowHints(DEFAULT_TUTORIAL_STATE)).toBe(true);
  });

  it('保存して読み戻せる', () => {
    const s = memoryStorage();
    saveTutorialState({ completed: true, hintsEnabled: false }, s);
    expect(s.map.get(TUTORIAL_STORAGE_KEY)).toBe(
      JSON.stringify({ completed: true, hintsEnabled: false }),
    );
    expect(loadTutorialState(s)).toEqual({ completed: true, hintsEnabled: false });
    expect(shouldShowHints(loadTutorialState(s))).toBe(false);
  });

  it('壊れた値・欠けた項目は既定値で補う', () => {
    const s = memoryStorage();
    s.setItem(TUTORIAL_STORAGE_KEY, '{not json');
    expect(loadTutorialState(s)).toEqual(DEFAULT_TUTORIAL_STATE);
    s.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ completed: true }));
    expect(loadTutorialState(s)).toEqual({ completed: true, hintsEnabled: true });
    s.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ completed: 'yes', hintsEnabled: 0 }));
    expect(loadTutorialState(s)).toEqual(DEFAULT_TUTORIAL_STATE);
    s.setItem(TUTORIAL_STORAGE_KEY, 'null');
    expect(loadTutorialState(s)).toEqual(DEFAULT_TUTORIAL_STATE);
  });

  it('保存先が例外を投げても落ちない', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(loadTutorialState(broken)).toEqual(DEFAULT_TUTORIAL_STATE);
    expect(() => saveTutorialState({ completed: true, hintsEnabled: true }, broken)).not.toThrow();
  });

  it('useTutorialState: 完了・ヒント非表示が保存される', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useTutorialState(s));
    expect(result.current.state).toEqual(DEFAULT_TUTORIAL_STATE);
    act(() => result.current.markCompleted());
    expect(result.current.state.completed).toBe(true);
    act(() => result.current.disableHints());
    expect(result.current.state).toEqual({ completed: true, hintsEnabled: false });
    expect(loadTutorialState(s)).toEqual({ completed: true, hintsEnabled: false });
    act(() => result.current.enableHints());
    expect(loadTutorialState(s).hintsEnabled).toBe(true);
  });
});
