import type { StorageLike } from '../state/persistence';

/**
 * 音声設定（ミュート・音量）の保存と読込（MVP-037）。
 *
 * 進行状況（urameku-mvp-v1）とは別キーに保存する。設定は端末固有の好みであり、
 * セーブデータの移行や競合処理の対象にしないため。
 */
export const AUDIO_SETTINGS_KEY = 'urameku-audio-settings';

export interface AudioSettings {
  muted: boolean;
  /** 0..1 */
  volume: number;
}

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  muted: false,
  volume: 0.6,
});

export function clampVolume(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_AUDIO_SETTINGS.volume;
  return Math.min(1, Math.max(0, value));
}

/** 不正値や欠けたフィールドを既定値で埋めて正規化する。 */
export function normalizeAudioSettings(raw: unknown): AudioSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AUDIO_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    muted: typeof r.muted === 'boolean' ? r.muted : DEFAULT_AUDIO_SETTINGS.muted,
    volume: clampVolume(r.volume),
  };
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadAudioSettings(storage: StorageLike | null = defaultStorage()): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    return normalizeAudioSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/** 保存できたら true。プライベートモード等で書けない場合は false（例外は投げない）。 */
export function saveAudioSettings(
  settings: AudioSettings,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(normalizeAudioSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/** 実効ゲイン。ミュート時は音量に関わらず 0。 */
export function effectiveGain(settings: AudioSettings): number {
  return settings.muted ? 0 : clampVolume(settings.volume);
}
