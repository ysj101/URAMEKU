import {
  MOTION_ATTRIBUTE,
  MOTION_STORAGE_KEY,
  applyMotionPreference,
  initMotionPreference,
  loadMotionPreference,
  saveMotionPreference,
  setMotionPreference,
} from './motionSettings';
import type { StorageLike } from '../state/persistence';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('motionSettings', () => {
  it('保存が無ければ system', () => {
    expect(loadMotionPreference(memoryStorage())).toBe('system');
    expect(loadMotionPreference(null)).toBe('system');
  });

  it('reduced を保存して読み戻せる', () => {
    const s = memoryStorage();
    saveMotionPreference('reduced', s);
    expect(s.map.get(MOTION_STORAGE_KEY)).toBe('reduced');
    expect(loadMotionPreference(s)).toBe('reduced');
  });

  it('system を保存するとキーが消える', () => {
    const s = memoryStorage();
    saveMotionPreference('reduced', s);
    saveMotionPreference('system', s);
    expect(s.map.has(MOTION_STORAGE_KEY)).toBe(false);
  });

  it('壊れた値は system 扱い', () => {
    const s = memoryStorage();
    s.map.set(MOTION_STORAGE_KEY, 'lots');
    expect(loadMotionPreference(s)).toBe('system');
  });

  it('storage が例外を投げても落ちない', () => {
    const s: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadMotionPreference(s)).toBe('system');
    expect(() => saveMotionPreference('reduced', s)).not.toThrow();
  });

  it('applyMotionPreference は data-motion 属性を付け外しする', () => {
    const root = document.createElement('html');
    applyMotionPreference('reduced', root);
    expect(root.getAttribute(MOTION_ATTRIBUTE)).toBe('reduced');
    applyMotionPreference('system', root);
    expect(root.hasAttribute(MOTION_ATTRIBUTE)).toBe(false);
  });

  it('setMotionPreference は保存と反映を同時に行い、init で復元できる', () => {
    const s = memoryStorage();
    const root = document.createElement('html');
    setMotionPreference('reduced', s, root);
    expect(root.getAttribute(MOTION_ATTRIBUTE)).toBe('reduced');

    const fresh = document.createElement('html');
    expect(initMotionPreference(s, fresh)).toBe('reduced');
    expect(fresh.getAttribute(MOTION_ATTRIBUTE)).toBe('reduced');
  });
});
