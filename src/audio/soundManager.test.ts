import {
  DEFAULT_MIN_INTERVAL_MS,
  installAutoUnlock,
  SOUND_FILES,
  SOUND_GAIN,
  SoundManager,
  type GameSound,
} from './soundManager';

/** テスト用の最小 AudioContext モック */
interface FakeGain {
  gain: { value: number };
  connect: ReturnType<typeof vi.fn>;
}
interface FakeSource {
  buffer: unknown;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
}
interface FakeContext {
  state: AudioContextState;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  decodeAudioData: ReturnType<typeof vi.fn>;
  destination: object;
  gains: FakeGain[];
  sources: FakeSource[];
}

function makeContext(opts: { resumeFails?: boolean; decodeFails?: boolean } = {}): FakeContext {
  const ctx: FakeContext = {
    state: 'suspended',
    destination: {},
    gains: [],
    sources: [],
    resume: vi.fn(async () => {
      if (opts.resumeFails) throw new Error('denied');
      ctx.state = 'running';
    }),
    close: vi.fn(async () => {
      ctx.state = 'closed';
    }),
    createGain: vi.fn(() => {
      const g: FakeGain = { gain: { value: 1 }, connect: vi.fn() };
      ctx.gains.push(g);
      return g;
    }),
    createBufferSource: vi.fn(() => {
      const s: FakeSource = { buffer: null, connect: vi.fn(), start: vi.fn() };
      ctx.sources.push(s);
      return s;
    }),
    decodeAudioData: vi.fn((_data: ArrayBuffer) => {
      if (opts.decodeFails) return Promise.reject(new Error('bad wav'));
      return Promise.resolve({ duration: 0.1 } as AudioBuffer);
    }),
  };
  return ctx;
}

function makeManager(
  ctx: FakeContext | null,
  extra: Partial<ConstructorParameters<typeof SoundManager>[0]> = {},
) {
  let t = 0;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const fetchBuffer = vi.fn(async (_url: string) => new ArrayBuffer(8));
  const manager = new SoundManager({
    createContext: () => ctx as unknown as AudioContext | null,
    fetchBuffer,
    now: clock.now,
    settings: { muted: false, volume: 0.6 },
    ...extra,
  });
  return { manager, clock, fetchBuffer };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('SOUND_GAIN', () => {
  it('全 11 音を網羅し、正の有限値である', () => {
    expect(SOUND_FILES).toHaveLength(11);
    for (const id of SOUND_FILES) {
      expect(SOUND_GAIN[id], id).toBeGreaterThan(0);
      expect(Number.isFinite(SOUND_GAIN[id])).toBe(true);
    }
    expect(Object.keys(SOUND_GAIN).sort()).toEqual([...SOUND_FILES].sort());
  });
});

describe('SoundManager', () => {
  it('unlock 前は再生しない（取得もしない）', async () => {
    const ctx = makeContext();
    const { manager, fetchBuffer } = makeManager(ctx);
    expect(manager.play('stamp')).toBe(false);
    await flush();
    expect(fetchBuffer).not.toHaveBeenCalled();
    expect(ctx.sources).toHaveLength(0);
    expect(manager.isUnlocked).toBe(false);
  });

  it('unlock 後は resume され、遅延ロード・デコードして再生する', async () => {
    const ctx = makeContext();
    const { manager, fetchBuffer } = makeManager(ctx);
    await expect(manager.unlock()).resolves.toBe(true);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(manager.isUnlocked).toBe(true);
    // マスター gain は音量
    expect(ctx.gains[0]?.gain.value).toBeCloseTo(0.6);

    expect(manager.play('stamp')).toBe(true);
    await flush();
    expect(fetchBuffer).toHaveBeenCalledTimes(1);
    expect(fetchBuffer.mock.calls[0]?.[0]).toMatch(/audio\/stamp\.wav$/);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]?.start).toHaveBeenCalled();
    // 音ごとの相対ゲイン
    expect(ctx.gains[1]?.gain.value).toBeCloseTo(SOUND_GAIN.stamp);
  });

  it('2 回目以降はキャッシュから再生し、再取得しない', async () => {
    const ctx = makeContext();
    const { manager, clock, fetchBuffer } = makeManager(ctx);
    await manager.unlock();
    manager.play('ui-tap');
    await flush();
    clock.advance(500);
    manager.play('ui-tap');
    await flush();
    expect(fetchBuffer).toHaveBeenCalledTimes(1);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(ctx.sources).toHaveLength(2);
  });

  it('ミュート時はマスター gain が 0 になり、ソースを作らない', async () => {
    const ctx = makeContext();
    const { manager, clock } = makeManager(ctx);
    await manager.unlock();
    manager.setMuted(true);
    expect(ctx.gains[0]?.gain.value).toBe(0);
    expect(manager.play('correct')).toBe(false);
    await flush();
    expect(ctx.sources).toHaveLength(0);
    manager.setMuted(false);
    expect(ctx.gains[0]?.gain.value).toBeCloseTo(0.6);
    clock.advance(500);
    manager.play('correct');
    await flush();
    expect(ctx.sources).toHaveLength(1);
  });

  it('setVolume はマスター gain に反映され 0..1 に丸められる', async () => {
    const ctx = makeContext();
    const { manager } = makeManager(ctx);
    await manager.unlock();
    manager.setVolume(0.3);
    expect(ctx.gains[0]?.gain.value).toBeCloseTo(0.3);
    manager.setVolume(5);
    expect(ctx.gains[0]?.gain.value).toBe(1);
    expect(manager.getSettings()).toEqual({ muted: false, volume: 1 });
  });

  it('同じ効果音の連打は最小間隔で間引く', async () => {
    const ctx = makeContext();
    const { manager, clock } = makeManager(ctx);
    await manager.unlock();
    manager.play('paper-flip');
    await flush();
    expect(manager.play('paper-flip')).toBe(false);
    clock.advance(DEFAULT_MIN_INTERVAL_MS - 1);
    expect(manager.play('paper-flip')).toBe(false);
    clock.advance(1);
    expect(manager.play('paper-flip')).toBe(true);
    // 別の音は間引かれない
    expect(manager.play('paper-place')).toBe(true);
    await flush();
    expect(ctx.sources).toHaveLength(3);
  });

  it('decode 失敗時は例外を出さず無音、以後その音は再試行しない', async () => {
    const ctx = makeContext({ decodeFails: true });
    const { manager, clock, fetchBuffer } = makeManager(ctx);
    await manager.unlock();
    expect(() => manager.play('discovery')).not.toThrow();
    await flush();
    expect(ctx.sources).toHaveLength(0);
    clock.advance(500);
    expect(manager.play('discovery')).toBe(false);
    await flush();
    expect(fetchBuffer).toHaveBeenCalledTimes(1);
  });

  it('fetch 失敗時も例外を出さず無音', async () => {
    const ctx = makeContext();
    const { manager } = makeManager(ctx, {
      fetchBuffer: vi.fn(async () => {
        throw new Error('404');
      }),
    });
    await manager.unlock();
    expect(() => manager.play('menu-open')).not.toThrow();
    await flush();
    expect(ctx.sources).toHaveLength(0);
    expect(ctx.decodeAudioData).not.toHaveBeenCalled();
  });

  it('AudioContext 非対応なら unlock は false で以後すべて無音', async () => {
    const { manager } = makeManager(null);
    await expect(manager.unlock()).resolves.toBe(false);
    expect(manager.isUnsupported).toBe(true);
    expect(manager.play('stamp')).toBe(false);
    expect(() => manager.setVolume(0.2)).not.toThrow();
  });

  it('resume が拒否されたら unlock は false で、再試行できる', async () => {
    const ctx = makeContext({ resumeFails: true });
    const { manager } = makeManager(ctx);
    await expect(manager.unlock()).resolves.toBe(false);
    expect(manager.play('stamp')).toBe(false);
    ctx.resume = vi.fn(async () => {
      ctx.state = 'running';
    });
    await expect(manager.unlock()).resolves.toBe(true);
  });

  it('コールバック形式の decodeAudioData でも動く', async () => {
    const ctx = makeContext();
    ctx.decodeAudioData = vi.fn(
      (_d: ArrayBuffer, ok: (b: AudioBuffer) => void) => void ok({ duration: 0.1 } as AudioBuffer),
    );
    const { manager } = makeManager(ctx);
    await manager.unlock();
    manager.play('evidence-pin');
    await flush();
    expect(ctx.sources).toHaveLength(1);
  });

  it('dispose 後は再生しない', async () => {
    const ctx = makeContext();
    const { manager } = makeManager(ctx);
    await manager.unlock();
    manager.dispose();
    expect(ctx.close).toHaveBeenCalled();
    expect(manager.play('stamp')).toBe(false);
  });
});

describe('installAutoUnlock', () => {
  it('最初の pointerdown で unlock し、成功後はリスナーを外す', async () => {
    const ctx = makeContext();
    const { manager } = makeManager(ctx);
    const target = new EventTarget();
    const remove = installAutoUnlock(manager, target);
    expect(manager.isUnlocked).toBe(false);
    target.dispatchEvent(new Event('pointerdown'));
    await flush();
    expect(manager.isUnlocked).toBe(true);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event('keydown'));
    await flush();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    remove();
  });

  it('unlock が失敗した場合はリスナーを残して次の操作で再試行する', async () => {
    const ctx = makeContext({ resumeFails: true });
    const { manager } = makeManager(ctx);
    const target = new EventTarget();
    installAutoUnlock(manager, target);
    target.dispatchEvent(new Event('keydown'));
    await flush();
    expect(manager.isUnlocked).toBe(false);
    ctx.resume = vi.fn(async () => {
      ctx.state = 'running';
    });
    target.dispatchEvent(new Event('touchend'));
    await flush();
    expect(manager.isUnlocked).toBe(true);
  });

  it('target が無ければ何もしない', () => {
    const { manager } = makeManager(makeContext());
    expect(() => installAutoUnlock(manager, null)()).not.toThrow();
  });
});

describe('GameSound 型', () => {
  it('SOUND_FILES の各 ID を play に渡せる', async () => {
    const ctx = makeContext();
    const { manager, clock } = makeManager(ctx);
    await manager.unlock();
    for (const id of SOUND_FILES as readonly GameSound[]) {
      clock.advance(100);
      expect(manager.play(id)).toBe(true);
    }
  });
});
