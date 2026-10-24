import { act, renderHook, waitFor } from '@testing-library/react';
import { REDUCED_MOTION_QUERY, readReducedMotion, useReducedMotion } from './useReducedMotion';
import { MOTION_ATTRIBUTE } from './motionSettings';

type Listener = (event: MediaQueryListEvent) => void;

/** matchMedia の最小モック。`set(true)` で OS 設定の変更を再現する。 */
function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const mql = {
    get matches() {
      return matches;
    },
    media: REDUCED_MOTION_QUERY,
    addEventListener: (_: 'change', l: Listener) => void listeners.add(l),
    removeEventListener: (_: 'change', l: Listener) => void listeners.delete(l),
  };
  const matchMedia = vi.fn((query: string) => {
    if (query !== REDUCED_MOTION_QUERY) throw new Error(`unexpected query ${query}`);
    return mql as unknown as MediaQueryList;
  });
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((l) => l({ matches: next } as MediaQueryListEvent));
    },
    listeners,
  };
}

describe('useReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute(MOTION_ATTRIBUTE);
  });

  it('matchMedia が無い環境では false', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    expect(readReducedMotion()).toBe(false);
  });

  it('OS 設定（prefers-reduced-motion）で true になり、変更に追従する', () => {
    const media = installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);
  });

  it('アプリ設定（html[data-motion="reduced"]）だけでも true になり、属性変更に追従する', async () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => document.documentElement.setAttribute(MOTION_ATTRIBUTE, 'reduced'));
    await waitFor(() => expect(result.current).toBe(true));

    act(() => document.documentElement.removeAttribute(MOTION_ATTRIBUTE));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('どちらかが真なら true（合成は OR）', () => {
    installMatchMedia(true);
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, 'reduced');
    expect(readReducedMotion()).toBe(true);
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, 'system');
    expect(readReducedMotion()).toBe(true);
  });

  it('アンマウントで購読を解除する', () => {
    const media = installMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
