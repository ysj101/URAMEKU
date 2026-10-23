import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  effectiveGain,
  loadAudioSettings,
  normalizeAudioSettings,
  saveAudioSettings,
} from './audioSettings';
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

describe('audioSettings', () => {
  it('既定はミュート OFF・音量 0.6', () => {
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({ muted: false, volume: 0.6 });
    expect(loadAudioSettings(memoryStorage())).toEqual({ muted: false, volume: 0.6 });
    expect(loadAudioSettings(null)).toEqual({ muted: false, volume: 0.6 });
  });

  it('保存して読み戻せる', () => {
    const s = memoryStorage();
    expect(saveAudioSettings({ muted: true, volume: 0.25 }, s)).toBe(true);
    expect(s.map.has(AUDIO_SETTINGS_KEY)).toBe(true);
    expect(loadAudioSettings(s)).toEqual({ muted: true, volume: 0.25 });
  });

  it('不正な値は既定値で補う・範囲外は丸める', () => {
    const s = memoryStorage();
    s.setItem(AUDIO_SETTINGS_KEY, '{broken');
    expect(loadAudioSettings(s)).toEqual(DEFAULT_AUDIO_SETTINGS);
    s.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ muted: 'yes', volume: 7 }));
    expect(loadAudioSettings(s)).toEqual({ muted: false, volume: 1 });
    expect(normalizeAudioSettings({ volume: -2 })).toEqual({ muted: false, volume: 0 });
    expect(normalizeAudioSettings({ volume: Number.NaN })).toEqual({ muted: false, volume: 0.6 });
    expect(normalizeAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('storage が書けないときは false を返し例外を投げない', () => {
    const s: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(saveAudioSettings({ muted: false, volume: 0.5 }, s)).toBe(false);
    expect(loadAudioSettings(s)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(saveAudioSettings({ muted: false, volume: 0.5 }, null)).toBe(false);
  });

  it('ミュート時の実効ゲインは 0', () => {
    expect(effectiveGain({ muted: true, volume: 0.9 })).toBe(0);
    expect(effectiveGain({ muted: false, volume: 0.9 })).toBe(0.9);
    expect(effectiveGain({ muted: false, volume: 3 })).toBe(1);
  });
});
