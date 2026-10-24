import {
  clearSaveData,
  loadSaveData,
  persistSaveData,
  STORAGE_KEY,
  type StorageLike,
} from './persistence';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('persistence', () => {
  it('保存して読み戻せる', () => {
    const s = memoryStorage();
    const data = {
      active: 'case-02',
      progress: { 'case-02': { opened: ['a'] } },
      finished: { 'case-01': true },
    };
    // @ts-expect-error 部分的な進行状態でも正規化されることを確認
    expect(persistSaveData(data, s)).toBe(true);
    const loaded = loadSaveData('case-01', s);
    expect(loaded.active).toBe('case-02');
    expect(loaded.progress['case-02']?.opened).toEqual(['a']);
    expect(loaded.progress['case-02']?.pinned).toEqual([]);
    expect(loaded.finished['case-01']).toBe(true);
  });
  it('壊れた JSON は初期値にフォールバックする', () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, '{not json');
    expect(loadSaveData('case-01', s)).toEqual({ active: 'case-01', progress: {}, finished: {} });
  });
  it('storage が無くてもクラッシュしない', () => {
    expect(loadSaveData('case-01', null).active).toBe('case-01');
    expect(persistSaveData({ active: 'x', progress: {}, finished: {} }, null)).toBe(false);
  });
  it('削除できる', () => {
    const s = memoryStorage();
    persistSaveData({ active: 'x', progress: {}, finished: {} }, s);
    clearSaveData(s);
    expect(s.map.size).toBe(0);
  });
});
