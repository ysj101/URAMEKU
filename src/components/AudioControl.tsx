import { UI } from '../data/ui';
import { useAudioSettings, useSound } from '../audio/useSound';
import { getSoundManager, type SoundManager } from '../audio/soundManager';
import type { StorageLike } from '../state/persistence';

export interface AudioControlProps {
  /** テスト用。省略時は共有マネージャ。 */
  manager?: SoundManager;
  /** テスト用。省略時は localStorage。 */
  storage?: StorageLike | null;
  className?: string;
}

/**
 * ミュートトグルと音量スライダー（MVP-037）。
 * 画面への組み込み・配置は別 Issue（設定画面）で行う。見た目は global.css 側で
 * `.audio-control` を定義する想定。
 */
export function AudioControl({ manager, storage, className }: AudioControlProps) {
  const mgr = manager ?? getSoundManager();
  const { settings, toggleMuted, setVolume } = useAudioSettings(mgr, storage);
  const play = useSound(mgr);
  const t = UI.settings.audio;
  const percent = Math.round(settings.volume * 100);

  return (
    <div
      className={['audio-control', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={t.label}
    >
      <button
        type="button"
        className="audio-control__mute"
        aria-pressed={settings.muted}
        aria-label={settings.muted ? t.unmute : t.mute}
        onClick={() => {
          toggleMuted();
          // ミュート解除時に確認音を鳴らす（unlock もこの操作で行われる）
          if (settings.muted) play('ui-tap');
        }}
      >
        <span className="audio-control__mute-text">{t.mute}</span>
        <span className="audio-control__mute-state">{settings.muted ? t.on : t.off}</span>
      </button>
      <label className="audio-control__volume">
        <span className="audio-control__volume-text">{t.volume}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          aria-label={t.volume}
          aria-valuetext={`${percent}%`}
          disabled={settings.muted}
          onChange={(e) => setVolume(Number(e.currentTarget.value) / 100)}
          onPointerUp={() => play('ui-tap')}
        />
        <output aria-hidden="true">{percent}%</output>
      </label>
    </div>
  );
}
