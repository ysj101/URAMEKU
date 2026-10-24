import { createSaveData } from './persistence';
import { LEGACY_KEYS, STORAGE_KEY, type SaveData, type StorageLike } from './persistence';
import {
  isAppKey,
  listAppKeys,
  resetCaseProgress,
  STORAGE_KEY_PREFIX,
  verifyWiped,
  wipeAllLocalData,
  wipeStorage,
  type EnumerableStorageLike,
} from './wipe';
import { makeProgress } from '../test/fixtures';

const LEGACY_KEY = 'paper-backside-mvp-v1';

/** localStorage 相当（列挙できる） */
function enumerableStorage(
  init: Record<string, string> = {},
): EnumerableStorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(init));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** 列挙できない最小 storage */
function minimalStorage(
  init: Record<string, string> = {},
): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(init));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('wipe: キーの判定と列挙', () => {
  it('現行キー・旧キー・接頭辞キーをアプリのキーとみなし、無関係なキーは除外する', () => {
    expect(isAppKey(STORAGE_KEY)).toBe(true);
    for (const k of LEGACY_KEYS) expect(isAppKey(k)).toBe(true);
    expect(isAppKey(`${STORAGE_KEY_PREFIX}settings`)).toBe(true);
    expect(isAppKey('other-app')).toBe(false);
    expect(isAppKey('')).toBe(false);
  });

  it('実在するアプリのキーだけを列挙する', () => {
    const s = enumerableStorage({
      [STORAGE_KEY]: '{}',
      [LEGACY_KEY]: '{}',
      'urameku-settings': '{}',
      'other-app': 'keep',
    });
    expect(listAppKeys(s)).toEqual([LEGACY_KEY, STORAGE_KEY, 'urameku-settings']);
  });

  it('列挙できない storage でも既知のキーは見つける', () => {
    const s = minimalStorage({ [STORAGE_KEY]: '{}', [LEGACY_KEY]: '{}' });
    expect(listAppKeys(s)).toEqual([LEGACY_KEY, STORAGE_KEY]);
  });

  it('storage が無ければ空', () => {
    expect(listAppKeys(null)).toEqual([]);
    expect(verifyWiped(null)).toEqual([]);
  });
});

describe('wipe: 削除と検証', () => {
  it('アプリのキーをすべて削除し、無関係なキーは残す', () => {
    const s = enumerableStorage({
      [STORAGE_KEY]: '{}',
      [LEGACY_KEY]: '{}',
      'urameku-settings': '{}',
      'other-app': 'keep',
    });
    const removed = wipeStorage(s);
    expect(removed).toEqual([LEGACY_KEY, STORAGE_KEY, 'urameku-settings']);
    expect(verifyWiped(s)).toEqual([]);
    expect(s.map.get('other-app')).toBe('keep');
    expect(s.map.size).toBe(1);
  });

  it('removeItem が失敗したキーを verifyWiped が残存として報告する', () => {
    const s = enumerableStorage({ [STORAGE_KEY]: '{}', 'urameku-stuck': '{}' });
    const base = s.removeItem;
    s.removeItem = (k) => {
      if (k === 'urameku-stuck') throw new Error('locked');
      base(k);
    };
    expect(wipeStorage(s)).toEqual([STORAGE_KEY]);
    expect(verifyWiped(s)).toEqual(['urameku-stuck']);
  });

  it('wipeAllLocalData は localStorage と sessionStorage の両方を消し、残存を報告する', () => {
    const local = enumerableStorage({ [STORAGE_KEY]: '{}', 'other-app': 'keep' });
    const session = enumerableStorage({ 'urameku-draft': 'x' });
    const r = wipeAllLocalData({ local, session });
    expect(r.removed).toEqual([`localStorage:${STORAGE_KEY}`, 'sessionStorage:urameku-draft']);
    expect(r.remaining).toEqual([]);
    expect(local.map.get('other-app')).toBe('keep');
    expect(session.map.size).toBe(0);
  });

  it('wipeAllLocalData は storage が無くても失敗しない', () => {
    expect(wipeAllLocalData({ local: null, session: null })).toEqual({
      removed: [],
      remaining: [],
    });
  });

  it('既定では実際の localStorage / sessionStorage を対象にする', () => {
    localStorage.setItem(STORAGE_KEY, '{}');
    localStorage.setItem('urameku-settings', '{}');
    localStorage.setItem('other-app', 'keep');
    sessionStorage.setItem('urameku-draft', 'x');
    try {
      const r = wipeAllLocalData();
      expect(r.remaining).toEqual([]);
      expect(r.removed).toHaveLength(3);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('urameku-settings')).toBeNull();
      expect(sessionStorage.getItem('urameku-draft')).toBeNull();
      expect(localStorage.getItem('other-app')).toBe('keep');
    } finally {
      localStorage.clear();
      sessionStorage.clear();
    }
  });
});

describe('resetCaseProgress', () => {
  const save: SaveData = {
    ...createSaveData('case-02'),
    active: 'case-02',
    progress: {
      'case-01': makeProgress({ opened: ['a'], published: true }),
      'case-02': makeProgress({ opened: ['b'] }),
    },
    finished: { 'case-01': true, 'case-02': true },
  };

  it('指定した事件の進行とクリア記録だけを消す', () => {
    const next = resetCaseProgress(save, 'case-02');
    expect(next.progress['case-02']).toBeUndefined();
    expect(next.finished['case-02']).toBeUndefined();
    expect(next.progress['case-01']).toEqual(save.progress['case-01']);
    expect(next.finished['case-01']).toBe(true);
    expect(next.active).toBe('case-02');
  });

  it('入力を変更しない（純粋関数）', () => {
    const snapshot = JSON.stringify(save);
    resetCaseProgress(save, 'case-01');
    expect(JSON.stringify(save)).toBe(snapshot);
  });

  it('存在しない事件 ID でも他を壊さない', () => {
    expect(resetCaseProgress(save, 'case-99')).toEqual(save);
  });
});
