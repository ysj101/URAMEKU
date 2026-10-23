import {
  clearSaveData,
  CURRENT_SAVE_VERSION,
  LEGACY_KEYS,
  loadSaveData,
  loadSaveDataDetailed,
  persistSaveData,
  STORAGE_KEY,
  type StorageLike,
} from './persistence';

const LEGACY_KEY = 'paper-backside-mvp-v1';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const v1Payload = {
  active: 'case-02',
  progress: { 'case-02': { opened: ['a'], calculations: { t1: '4' } } },
  finished: { 'case-01': true },
};

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
  it('書き込みは常に最新バージョンで savedAt が付く', () => {
    const s = memoryStorage();
    const before = Date.now();
    persistSaveData({ active: 'x', progress: {}, finished: {} }, s);
    const stored = JSON.parse(s.map.get(STORAGE_KEY)!) as { version: number; savedAt: string };
    expect(stored.version).toBe(CURRENT_SAVE_VERSION);
    expect(stored.version).toBe(2);
    expect(Date.parse(stored.savedAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(stored.savedAt).toBe(new Date(stored.savedAt).toISOString());
  });
  it('読み戻した SaveData には version / savedAt を含めない', () => {
    const s = memoryStorage();
    persistSaveData({ active: 'x', progress: {}, finished: {} }, s);
    expect(loadSaveData('case-01', s)).toEqual({ active: 'x', progress: {}, finished: {} });
  });
  it('v1（version 無し）の現行キーを v2 として読める', () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, JSON.stringify(v1Payload));
    const r = loadSaveDataDetailed('case-01', s);
    expect(r.sourceKey).toBe(STORAGE_KEY);
    expect(r.migratedFrom).toBe(1);
    expect(r.reset).toBe(false);
    expect(r.data.active).toBe('case-02');
    expect(r.data.progress['case-02']?.calculations).toEqual({ t1: '4' });
  });
  it('現行キーが無ければ旧キー（試作 v0）から読み、旧キーは消さない', () => {
    expect(LEGACY_KEYS).toContain(LEGACY_KEY);
    const s = memoryStorage();
    s.setItem(LEGACY_KEY, JSON.stringify(v1Payload));
    const r = loadSaveDataDetailed('case-01', s);
    expect(r.sourceKey).toBe(LEGACY_KEY);
    expect(r.migratedFrom).toBe(0);
    expect(r.data.active).toBe('case-02');
    expect(r.data.finished).toEqual({ 'case-01': true });
    expect(s.map.has(LEGACY_KEY)).toBe(true);
    // 保存し直すと現行キーに v2 で書かれ、旧キーはそのまま
    persistSaveData(r.data, s);
    expect(JSON.parse(s.map.get(STORAGE_KEY)!).version).toBe(2);
    expect(s.map.has(LEGACY_KEY)).toBe(true);
  });
  it('現行キーがあれば旧キーは見ない', () => {
    const s = memoryStorage();
    s.setItem(LEGACY_KEY, JSON.stringify({ ...v1Payload, active: 'legacy' }));
    persistSaveData({ active: 'current', progress: {}, finished: {} }, s);
    expect(loadSaveData('case-01', s).active).toBe('current');
  });
  it('壊れた JSON は初期値にフォールバックする（reset: true）', () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, '{not json');
    const r = loadSaveDataDetailed('case-01', s);
    expect(r.reset).toBe(true);
    expect(r.data).toEqual({ active: 'case-01', progress: {}, finished: {} });
  });
  it('配列や未来バージョンでもクラッシュしない', () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, '[1,2,3]');
    expect(loadSaveDataDetailed('case-01', s).reset).toBe(true);
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 99, ...v1Payload }));
    const r = loadSaveDataDetailed('case-01', s);
    expect(r.reset).toBe(false);
    expect(r.migratedFrom).toBe(99);
    expect(r.data.active).toBe('case-02');
  });
  it('getItem が例外を投げても初期値', () => {
    const s: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadSaveData('case-01', s)).toEqual({ active: 'case-01', progress: {}, finished: {} });
  });
  it('QuotaExceededError は false を返し例外を外に出さない', () => {
    const s: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(() => persistSaveData({ active: 'x', progress: {}, finished: {} }, s)).not.toThrow();
    expect(persistSaveData({ active: 'x', progress: {}, finished: {} }, s)).toBe(false);
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
