import { act, renderHook } from '@testing-library/react';
import { CASES } from '../data/cases';
import { SAVE_DEBOUNCE_MS, useGame } from './useGame';
import { persistSaveData, STORAGE_KEY, createSaveData, type StorageLike } from './persistence';
import { createProgress } from '../domain/game';

/** setItem の回数を数えられるメモリ storage */
function memoryStorage(): StorageLike & { map: Map<string, string>; writes: number } {
  const map = new Map<string, string>();
  const s = {
    map,
    writes: 0,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      s.writes += 1;
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
  return s;
}

function stored(s: { map: Map<string, string> }) {
  return JSON.parse(s.map.get(STORAGE_KEY) ?? 'null') as {
    version: number;
    savedAt: string;
    revision: number;
    active: string;
    session: { stage: string; lastDocumentId: string | null };
    progress: Record<string, { calculations: Record<string, string>; opened: string[] }>;
  } | null;
}

function fireStorage(newValue: string | null, key: string | null = STORAGE_KEY) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  });
}

const FIRST = CASES[0]!;
const SECOND = CASES[1]!;
const FREE_DOC = FIRST.documents.find((d) => d.cost === 0)!.id;
// Persistence debounce is independent of case content and legacy answer keys.
const TASK = 'legacy_input';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useGame の途中保存と復元', () => {
  it('操作 → アンマウント → 再マウントで stage と進行、最後に開いた資料が復元される', () => {
    const s = memoryStorage();
    const first = renderHook(() => useGame({ storage: s }));
    act(() => first.result.current.dispatch({ type: 'open-document', documentId: FREE_DOC }));
    act(() =>
      first.result.current.dispatch({ type: 'set-calculation', taskId: TASK, value: '12' }),
    );
    act(() => first.result.current.setStage('article'));
    expect(first.result.current.stage).toBe('article');
    expect(first.result.current.lastDocumentId).toBe(FREE_DOC);
    // デバウンス中にアンマウントしても即時フラッシュされる
    first.unmount();
    expect(stored(s)?.session).toEqual({ stage: 'article', lastDocumentId: FREE_DOC });

    const second = renderHook(() => useGame({ storage: s }));
    expect(second.result.current.stage).toBe('article');
    expect(second.result.current.lastDocumentId).toBe(FREE_DOC);
    expect(second.result.current.progress.opened).toEqual([FREE_DOC]);
    expect(second.result.current.progress.calculations[TASK]).toBe('12');
    expect(second.result.current.saveStatus).toBe('saved');
  });

  it('事件の切り替えと reset で途中状態は調査画面に戻る', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    act(() => result.current.dispatch({ type: 'open-document', documentId: FREE_DOC }));
    act(() => result.current.setStage('article'));
    act(() => result.current.selectCase(SECOND.id));
    expect(result.current.stage).toBe('investigate');
    expect(result.current.lastDocumentId).toBeNull();
    act(() => result.current.selectCase(FIRST.id));
    act(() => result.current.setStage('article'));
    act(() => result.current.dispatch({ type: 'reset' }));
    expect(result.current.stage).toBe('investigate');
    expect(result.current.lastDocumentId).toBeNull();
    expect(result.current.progress.opened).toEqual([]);
  });

  it('保存された資料 ID が事件に無ければ捨て、事件が無ければ最初の事件に戻す', () => {
    const s = memoryStorage();
    persistSaveData(
      { ...createSaveData(FIRST.id), session: { stage: 'article', lastDocumentId: 'ghost' } },
      s,
    );
    const a = renderHook(() => useGame({ storage: s }));
    expect(a.result.current.stage).toBe('article');
    expect(a.result.current.lastDocumentId).toBeNull();
    a.unmount();
    persistSaveData(
      { ...createSaveData('no-such-case'), session: { stage: 'article', lastDocumentId: null } },
      s,
    );
    const b = renderHook(() => useGame({ storage: s }));
    expect(b.result.current.current.id).toBe(FIRST.id);
    expect(b.result.current.stage).toBe('investigate');
  });
});

describe('useGame のデバウンス', () => {
  it('連続入力は 1 回の setItem にまとまり、revision は操作ごとに増える', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    for (const v of ['1', '12', '123']) {
      act(() => result.current.dispatch({ type: 'set-calculation', taskId: TASK, value: v }));
      act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 50));
    }
    expect(s.writes).toBe(0);
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(s.writes).toBe(1);
    const data = stored(s)!;
    expect(data.version).toBe(4);
    expect(data.revision).toBe(3);
    expect(data.progress[FIRST.id]?.calculations[TASK]).toBe('123');
  });

  it('pagehide / beforeunload で待たずに書く', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    act(() => result.current.setStage('article'));
    expect(s.writes).toBe(0);
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(s.writes).toBe(1);
    expect(stored(s)?.session.stage).toBe('article');
    // 未保存の変更が無ければ書かない
    act(() => window.dispatchEvent(new Event('beforeunload')));
    expect(s.writes).toBe(1);
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2));
    expect(s.writes).toBe(1);
  });
});

describe('useGame の競合処理（他タブ）', () => {
  it('他タブの新しい保存（revision が大きい）を取り込む', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    act(() => result.current.setStage('article'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(stored(s)?.revision).toBe(1);

    const remote = {
      ...createSaveData(SECOND.id),
      progress: { [SECOND.id]: { ...createProgress(SECOND), published: true } },
      ...(SECOND.v2 ? { caseRevisions: { [SECOND.id]: SECOND.v2.revision } } : {}),
      finished: { [SECOND.id]: true },
      session: { stage: 'investigate' as const, lastDocumentId: null },
      revision: 5,
    };
    const other = memoryStorage();
    persistSaveData(remote, other);
    fireStorage(other.map.get(STORAGE_KEY)!);

    expect(result.current.current.id).toBe(SECOND.id);
    expect(result.current.progress.published).toBe(true);
    expect(result.current.finished[SECOND.id]).toBe(true);
    expect(result.current.stage).toBe('investigate');
    // 取り込んだ内容を書き戻さない
    const before = s.writes;
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2));
    expect(s.writes).toBe(before);
    // 次の自タブの変更は取り込んだ revision より大きくなる
    act(() => result.current.setStage('article'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(stored(s)?.revision).toBe(6);
  });

  it('他タブの古い保存（revision が小さい）は無視する', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    act(() => result.current.dispatch({ type: 'open-document', documentId: FREE_DOC }));
    act(() => result.current.setStage('article'));
    act(() => result.current.setStage('investigate'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(stored(s)?.revision).toBe(3);

    const other = memoryStorage();
    persistSaveData({ ...createSaveData(SECOND.id), revision: 1 }, other);
    fireStorage(other.map.get(STORAGE_KEY)!);
    expect(result.current.current.id).toBe(FIRST.id);
    expect(result.current.progress.opened).toEqual([FREE_DOC]);
  });

  it('同じ revision なら savedAt が新しい方を取り込む', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    act(() => result.current.setStage('article'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    const mine = stored(s)!;
    expect(mine.revision).toBe(1);

    const other = memoryStorage();
    const older = new Date(Date.parse(mine.savedAt) - 60_000).toISOString();
    persistSaveData({ ...createSaveData(SECOND.id), revision: 1 }, other, () => older);
    fireStorage(other.map.get(STORAGE_KEY)!);
    expect(result.current.current.id).toBe(FIRST.id);

    const newer = new Date(Date.parse(mine.savedAt) + 60_000).toISOString();
    persistSaveData({ ...createSaveData(SECOND.id), revision: 1 }, other, () => newer);
    fireStorage(other.map.get(STORAGE_KEY)!);
    expect(result.current.current.id).toBe(SECOND.id);
  });

  it('別キーや壊れた値は無視し、削除（newValue null）は初期状態に合わせる', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    act(() => result.current.setStage('article'));
    fireStorage(
      JSON.stringify({ ...createSaveData(SECOND.id), revision: 99, version: 3 }),
      'other',
    );
    expect(result.current.stage).toBe('article');
    fireStorage('{broken');
    expect(result.current.stage).toBe('article');
    fireStorage(null);
    expect(result.current.stage).toBe('investigate');
    expect(result.current.current.id).toBe(FIRST.id);
  });
});

describe('useGame の saveStatus', () => {
  it('QuotaExceeded で failed になり、次に成功すれば saved に戻る', () => {
    const s = memoryStorage();
    let fail = true;
    const flaky: StorageLike = {
      getItem: (k) => s.getItem(k),
      setItem: (k, v) => {
        if (fail) throw new DOMException('quota', 'QuotaExceededError');
        s.setItem(k, v);
      },
      removeItem: (k) => s.removeItem(k),
    };
    const { result } = renderHook(() => useGame({ storage: flaky }));
    expect(result.current.saveStatus).toBe('saved');
    act(() => result.current.setStage('article'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(result.current.saveStatus).toBe('failed');
    expect(result.current.stage).toBe('article');
    fail = false;
    act(() => result.current.setStage('investigate'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(result.current.saveStatus).toBe('saved');
    expect(stored(s)?.session.stage).toBe('investigate');
  });

  it('storage が無ければ unavailable', () => {
    const { result } = renderHook(() => useGame({ storage: null }));
    expect(result.current.saveStatus).toBe('unavailable');
    act(() => result.current.setStage('article'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(result.current.saveStatus).toBe('unavailable');
    expect(result.current.stage).toBe('article');
  });

  it('resetAll で保存を消し、初期状態に戻る', () => {
    const s = memoryStorage();
    const { result } = renderHook(() => useGame({ storage: s }));
    act(() => result.current.setStage('article'));
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS));
    expect(s.map.has(STORAGE_KEY)).toBe(true);
    act(() => result.current.resetAll());
    expect(s.map.has(STORAGE_KEY)).toBe(false);
    expect(result.current.stage).toBe('investigate');
    act(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2));
    expect(s.map.has(STORAGE_KEY)).toBe(false);
  });
});
