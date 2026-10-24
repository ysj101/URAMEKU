import { useCallback, useEffect, useState } from 'react';
import {
  type GameSound,
  getSoundManager,
  installAutoUnlock,
  type SoundManager,
} from './soundManager';
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from './audioSettings';
import type { StorageLike } from '../state/persistence';

/**
 * 効果音を鳴らす関数を返す。
 *
 *   const play = useSound();
 *   play('stamp');
 *
 * 初回マウント時に自動 unlock リスナーを登録する（ユーザー操作まで音は出ない）。
 */
export function useSound(manager: SoundManager = getSoundManager()): (id: GameSound) => void {
  useEffect(() => installAutoUnlock(manager), [manager]);
  return useCallback((id: GameSound) => void manager.play(id), [manager]);
}

export interface UseAudioSettingsResult {
  settings: AudioSettings;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setVolume: (volume: number) => void;
}

/**
 * ミュート・音量の状態。変更は即座にマネージャへ適用し、localStorage に保存する。
 */
export function useAudioSettings(
  manager: SoundManager = getSoundManager(),
  storage?: StorageLike | null,
): UseAudioSettingsResult {
  const [settings, setSettings] = useState<AudioSettings>(() =>
    storage === undefined ? manager.getSettings() : loadAudioSettings(storage),
  );

  const update = useCallback(
    (patch: (prev: AudioSettings) => Partial<AudioSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch(prev) };
        manager.applySettings(next);
        if (storage === undefined) saveAudioSettings(next);
        else saveAudioSettings(next, storage);
        return next;
      });
    },
    [manager, storage],
  );

  const setMuted = useCallback((muted: boolean) => update(() => ({ muted })), [update]);
  const toggleMuted = useCallback(() => update((prev) => ({ muted: !prev.muted })), [update]);
  const setVolume = useCallback((volume: number) => update(() => ({ volume })), [update]);

  return { settings, setMuted, toggleMuted, setVolume };
}
