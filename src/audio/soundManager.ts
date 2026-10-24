import type { GameSound } from '../audioAssets';
import { assetUrl } from '../data/assets';
import {
  DEFAULT_AUDIO_SETTINGS,
  clampVolume,
  effectiveGain,
  loadAudioSettings,
  type AudioSettings,
} from './audioSettings';

export { SOUND_FILES, type GameSound } from '../audioAssets';

/**
 * 各効果音の相対ゲイン（MVP-037）。
 *
 * scripts/normalize_audio.py で RMS を計測し、-18 dBFS RMS に揃える係数を初期値にした
 * （ピークが -1 dBFS を超えるものは天井で止めている）。
 * 計測結果は docs/AUDIO.md の表を参照。wav 本体は変更していない。
 */
export const SOUND_GAIN: Record<GameSound, number> = {
  'case-complete': 2.24,
  correct: 1.54,
  discovery: 1.72,
  'evidence-link': 1.16,
  'evidence-pin': 2.73,
  incorrect: 2.65,
  'menu-open': 3.17,
  'paper-flip': 1.18,
  'paper-place': 2.74,
  stamp: 3.15,
  'ui-tap': 2.11,
};

/** 同じ効果音の連打をこの間隔（ms）未満で間引く。 */
export const DEFAULT_MIN_INTERVAL_MS = 60;

export interface SoundManagerOptions {
  /** AudioContext の生成。非対応環境では null を返す。 */
  createContext?: () => AudioContext | null;
  /** wav を取得して ArrayBuffer を返す。 */
  fetchBuffer?: (url: string) => Promise<ArrayBuffer>;
  /** 効果音 ID から URL を引く。 */
  resolveUrl?: (id: GameSound) => string;
  /** 連打判定に使う時計（ms）。 */
  now?: () => number;
  minIntervalMs?: number;
  /** 初期設定。省略時は localStorage から読む。 */
  settings?: AudioSettings;
  gains?: Partial<Record<GameSound, number>>;
}

type Ctor = typeof AudioContext;

function defaultCreateContext(): AudioContext | null {
  try {
    const w = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const C = w.AudioContext ?? w.webkitAudioContext;
    return C ? new C() : null;
  } catch {
    return null;
  }
}

async function defaultFetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio fetch failed: ${res.status} ${url}`);
  return res.arrayBuffer();
}

function defaultResolveUrl(id: GameSound): string {
  return assetUrl(`audio/${id}.wav`);
}

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Promise 形式と旧 Safari のコールバック形式の両方に対応する
  return new Promise((resolve, reject) => {
    try {
      const maybe = ctx.decodeAudioData(data, resolve, reject);
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === 'function') {
        (maybe as Promise<AudioBuffer>).then(resolve, reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Web Audio API による効果音再生。
 *
 * - AudioContext はユーザー操作（unlock）後に初めて生成・resume する（iOS Safari / Android Chrome の自動再生制限）。
 * - wav は初回再生時に遅延ロード・デコードしてキャッシュする。
 * - マスター GainNode にミュート/音量を適用する。
 * - 非対応環境・取得失敗・デコード失敗はすべて無音で握りつぶす（UI に例外を出さない）。
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private unsupported = false;
  private settings: AudioSettings;
  private readonly buffers = new Map<GameSound, AudioBuffer>();
  private readonly pending = new Map<GameSound, Promise<AudioBuffer | null>>();
  private readonly rawCache = new Map<GameSound, Promise<ArrayBuffer | null>>();
  private readonly failed = new Set<GameSound>();
  private readonly lastPlayed = new Map<GameSound, number>();
  private readonly createContext: () => AudioContext | null;
  private readonly fetchBuffer: (url: string) => Promise<ArrayBuffer>;
  private readonly resolveUrl: (id: GameSound) => string;
  private readonly now: () => number;
  private readonly minIntervalMs: number;
  private readonly gains: Record<GameSound, number>;

  constructor(options: SoundManagerOptions = {}) {
    this.createContext = options.createContext ?? defaultCreateContext;
    this.fetchBuffer = options.fetchBuffer ?? defaultFetchBuffer;
    this.resolveUrl = options.resolveUrl ?? defaultResolveUrl;
    this.now =
      options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.settings = options.settings ? { ...options.settings } : loadAudioSettings();
    this.gains = { ...SOUND_GAIN, ...(options.gains ?? {}) };
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** AudioContext が使えない環境（または生成に失敗した）なら true。 */
  get isUnsupported(): boolean {
    return this.unsupported;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * ユーザー操作のハンドラ内から呼ぶ。AudioContext を生成し resume する。
   * 何度呼んでも安全。失敗しても例外は投げない。
   */
  async unlock(): Promise<boolean> {
    if (this.unsupported) return false;
    if (!this.ctx) {
      const ctx = this.createContext();
      if (!ctx) {
        this.unsupported = true;
        return false;
      }
      this.ctx = ctx;
      try {
        this.master = ctx.createGain();
        this.master.gain.value = effectiveGain(this.settings);
        this.master.connect(ctx.destination);
      } catch {
        this.unsupported = true;
        this.ctx = null;
        this.master = null;
        return false;
      }
    }
    try {
      if (this.ctx.state !== 'running') await this.ctx.resume();
    } catch {
      // resume が拒否されても次の操作で再試行できるようにする
    }
    this.unlocked = this.ctx.state === 'running';
    return this.unlocked;
  }

  applySettings(settings: AudioSettings): void {
    this.settings = { muted: settings.muted, volume: clampVolume(settings.volume) };
    if (this.master) {
      try {
        this.master.gain.value = effectiveGain(this.settings);
      } catch {
        // ignore
      }
    }
  }

  setMuted(muted: boolean): void {
    this.applySettings({ ...this.settings, muted });
  }

  setVolume(volume: number): void {
    this.applySettings({ ...this.settings, volume });
  }

  /** wav の取得だけ先にしておく（unlock 前でも可。デコードは AudioContext 生成後）。 */
  preload(id: GameSound): void {
    void this.fetchRaw(id);
  }

  /**
   * 効果音を鳴らす。unlock 前・ミュート中・連打・失敗時は何もしない。
   * 戻り値は「再生をスケジュールした（または非同期ロードに回した）」か。
   */
  play(id: GameSound): boolean {
    if (!this.unlocked || !this.ctx || !this.master) return false;
    if (this.failed.has(id)) return false;
    const t = this.now();
    const last = this.lastPlayed.get(id);
    if (last !== undefined && t - last < this.minIntervalMs) return false;
    this.lastPlayed.set(id, t);
    if (this.settings.muted) return false;

    const buffer = this.buffers.get(id);
    if (buffer) {
      this.start(id, buffer);
      return true;
    }
    void this.load(id).then((b) => {
      if (b && this.unlocked && !this.settings.muted) this.start(id, b);
    });
    return true;
  }

  /** テストや画面遷移時に利用。コンテキストを閉じて状態を戻す。 */
  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.buffers.clear();
    this.pending.clear();
    this.lastPlayed.clear();
    try {
      void ctx?.close();
    } catch {
      // ignore
    }
  }

  private start(id: GameSound, buffer: AudioBuffer): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = this.gains[id] ?? 1;
      src.connect(g);
      g.connect(master);
      src.start(0);
    } catch {
      // 再生失敗は無音で握りつぶす
    }
  }

  private fetchRaw(id: GameSound): Promise<ArrayBuffer | null> {
    let p = this.rawCache.get(id);
    if (!p) {
      p = this.fetchBuffer(this.resolveUrl(id)).catch(() => {
        this.rawCache.delete(id);
        return null;
      });
      this.rawCache.set(id, p);
    }
    return p;
  }

  private load(id: GameSound): Promise<AudioBuffer | null> {
    let p = this.pending.get(id);
    if (p) return p;
    p = (async () => {
      const ctx = this.ctx;
      if (!ctx) return null;
      const raw = await this.fetchRaw(id);
      if (!raw) {
        this.failed.add(id);
        return null;
      }
      try {
        // decodeAudioData は ArrayBuffer を detach するためコピーを渡す
        const buffer = await decode(ctx, raw.slice(0));
        this.buffers.set(id, buffer);
        return buffer;
      } catch {
        this.failed.add(id);
        return null;
      } finally {
        this.pending.delete(id);
      }
    })();
    this.pending.set(id, p);
    return p;
  }
}

/**
 * 最初の pointerdown / keydown / touchend で unlock() を呼ぶリスナーを登録する。
 * 戻り値は解除関数。unlock が成功するまでリスナーは残る（iOS で最初の resume が拒否される場合に備える）。
 */
export function installAutoUnlock(
  manager: SoundManager,
  target: EventTarget | null = typeof window !== 'undefined' ? window : null,
): () => void {
  if (!target) return () => {};
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  const remove = () => {
    for (const ev of events) target.removeEventListener(ev, handler, true);
  };
  const handler = () => {
    void manager.unlock().then((ok) => {
      if (ok) remove();
    });
  };
  for (const ev of events) target.addEventListener(ev, handler, { capture: true, passive: true });
  return remove;
}

let shared: SoundManager | null = null;

/** アプリ全体で共有するマネージャ。 */
export function getSoundManager(): SoundManager {
  if (!shared) shared = new SoundManager();
  return shared;
}

/** テスト用。共有インスタンスを差し替える（null で破棄）。 */
export function setSoundManager(manager: SoundManager | null): void {
  shared?.dispose();
  shared = manager;
}

/** 既定設定の再エクスポート（UI 初期値用）。 */
export { DEFAULT_AUDIO_SETTINGS };
