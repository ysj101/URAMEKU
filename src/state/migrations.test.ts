import {
  CURRENT_SAVE_VERSION,
  detectVersion,
  migrate,
  migrations,
  toSaveDataV2,
  toSaveDataV3,
} from './migrations';

const NOW = '2026-10-24T00:00:00.000Z';
const now = () => NOW;

const v0 = {
  active: 'case-02',
  progress: {
    'case-01': {
      opened: ['d1', 'd2'],
      chosenLink: ['d1', 'd2'],
      calculations: { t1: '12.5', t2: '' },
      article: ['h1', 'h2', 'h3'],
      published: true,
      revealed: true,
    },
    // 試作はフィールドの欠落を許していた
    'case-02': { opened: ['d1'] },
  },
  finished: { 'case-01': true },
};

const v1 = { ...v0 };

describe('migrations 配列', () => {
  it('0 から最新まで隙間なく連なる', () => {
    let v = 0;
    for (const step of migrations) {
      expect(step.from).toBe(v);
      expect(step.to).toBe(v + 1);
      v = step.to;
    }
    expect(v).toBe(CURRENT_SAVE_VERSION);
  });
});

describe('detectVersion', () => {
  it('version 無しは assumeVersion', () => {
    expect(detectVersion({}, 0)).toBe(0);
    expect(detectVersion({})).toBe(1);
  });
  it('不正な version は null', () => {
    expect(detectVersion({ version: '2' })).toBeNull();
    expect(detectVersion({ version: -1 })).toBeNull();
    expect(detectVersion({ version: 1.5 })).toBeNull();
    expect(detectVersion([])).toBeNull();
  });
});

describe('migrate', () => {
  it('v0 → v4（旧キー形式、calculations は文字列）', () => {
    const r = migrate(v0, 'case-01', { assumeVersion: 0, now });
    expect(r.reset).toBe(false);
    expect(r.migratedFrom).toBe(0);
    expect(r.data.active).toBe('case-02');
    expect(r.data.legacyProgress?.['case-01']?.calculations).toEqual({ t1: '12.5', t2: '' });
    expect(r.data.legacyProgress?.['case-01']?.published).toBe(true);
    expect(r.data.legacyProgress?.['case-02']).toEqual({
      opened: ['d1'],
      chosenLink: [],
      calculations: {},
      article: [],
      published: false,
      revealed: false,
    });
    expect(r.data.legacyFinished).toEqual({ 'case-01': true });
    expect(r.data.finished).toEqual({});
    expect(r.data.progress).toEqual({});
    expect(r.data.session).toEqual({ stage: 'investigate', lastDocumentId: null });
    expect(r.data.revision).toBe(0);
  });
  it('v1 → v4（現行キー、version 無し）', () => {
    const r = migrate(v1, 'case-01', { now });
    expect(r.reset).toBe(false);
    expect(r.migratedFrom).toBe(1);
    expect(r.data.active).toBe('case-02');
    expect(r.data.legacyProgress?.['case-01']?.opened).toEqual(['d1', 'd2']);
  });
  it('v2 → v4（session は調査画面、revision 0）', () => {
    const r = migrate({ ...v1, version: 2, savedAt: NOW }, 'case-01', { now });
    expect(r.reset).toBe(false);
    expect(r.migratedFrom).toBe(2);
    expect(r.data.active).toBe('case-02');
    expect(r.data.session).toEqual({ stage: 'investigate', lastDocumentId: null });
    expect(r.data.revision).toBe(0);
  });
  it('v3 は旧記録を保管してV2を開始する', () => {
    const r = migrate(
      {
        ...v1,
        version: 3,
        savedAt: NOW,
        session: { stage: 'article', lastDocumentId: 'd2' },
        revision: 12,
      },
      'case-01',
      { now },
    );
    expect(r.reset).toBe(false);
    expect(r.migratedFrom).toBe(3);
    expect(r.data.session).toEqual({ stage: 'investigate', lastDocumentId: null });
    expect(r.data.revision).toBe(12);
  });
  it('session / revision の不正値は既定値に整える', () => {
    const cases: [unknown, unknown][] = [
      [{ stage: 'result', lastDocumentId: 42 }, -1],
      ['x', '3'],
      [null, 1.5],
      [{ stage: 'article', lastDocumentId: '' }, null],
    ];
    for (const [session, revision] of cases) {
      const r = migrate({ ...v1, version: 4, savedAt: NOW, session, revision }, 'case-01', { now });
      expect(r.data.session.lastDocumentId).toBeNull();
      expect(r.data.revision).toBe(0);
    }
    expect(
      migrate({ ...v1, version: 4, session: { stage: 'article' } }, 'case-01', { now }).data.session
        .stage,
    ).toBe('article');
  });
  it('解釈不能（配列・null・文字列・version 不正）は初期化', () => {
    for (const raw of [[], null, undefined, 'x', 42, { version: 'two' }, { version: -3 }]) {
      const r = migrate(raw, 'case-01', { now });
      expect(r.reset).toBe(true);
      expect(r.migratedFrom).toBeNull();
      expect(r.data).toEqual({
        active: 'case-01',
        progress: {},
        finished: {},
        session: { stage: 'investigate', lastDocumentId: null },
        revision: 0,
      });
    }
  });
  it('未来バージョン（99）は初期化せず読めるフィールドだけ読む', () => {
    const r = migrate(
      {
        version: 99,
        savedAt: NOW,
        active: 'case-03',
        progress: v0.progress,
        finished: v0.finished,
        extra: 1,
      },
      'case-01',
      { now },
    );
    expect(r.reset).toBe(false);
    expect(r.migratedFrom).toBe(99);
    expect(r.data.active).toBe('case-03');
    expect(r.data.progress['case-01']?.opened).toEqual(['d1', 'd2']);
    expect(r.data.finished).toEqual({ 'case-01': true });
    expect(r.data).not.toHaveProperty('extra');
  });
  it('finished の非 boolean は落ちる', () => {
    const r = migrate(
      { active: 'case-01', finished: { a: true, b: 'true', c: 1, d: false, e: null } },
      'case-01',
      { now },
    );
    expect(r.data.legacyFinished).toEqual({ a: true });
  });
  it('progress の各ケースが normalizeProgress を通る', () => {
    const r = migrate(
      {
        active: 'case-01',
        progress: {
          a: null,
          b: 'string',
          c: { opened: [1, 'x', null], chosenLink: ['1', '2', '3'], article: ['1', '2', '3', '4'] },
          d: { calculations: { t1: 3, t2: 'x', t3: null, t4: { v: 1 } }, published: 'yes' },
        },
      },
      'case-01',
      { now },
    );
    const empty = {
      opened: [],
      chosenLink: [],
      calculations: {},
      article: [],
      published: false,
      revealed: false,
    };
    expect(r.data.legacyProgress?.a).toEqual(empty);
    expect(r.data.legacyProgress?.b).toEqual(empty);
    expect(r.data.legacyProgress?.c?.opened).toEqual(['x']);
    expect(r.data.legacyProgress?.c?.chosenLink).toEqual(['1', '2']);
    expect(r.data.legacyProgress?.c?.article).toEqual(['1', '2', '3']);
    expect(r.data.legacyProgress?.d?.calculations).toEqual({ t1: '3', t2: 'x' });
    expect(r.data.legacyProgress?.d?.published).toBe(false);
  });
  it('active が文字列でなければ fallback', () => {
    expect(migrate({ active: 3 }, 'case-01', { now }).data.active).toBe('case-01');
    expect(migrate({ active: '' }, 'case-01', { now }).data.active).toBe('case-01');
  });
  it('入力を変更しない（純粋）', () => {
    const input = structuredClone(v0);
    migrate(input, 'case-01', { assumeVersion: 0, now });
    expect(input).toEqual(v0);
  });
});

describe('toSaveDataV3', () => {
  it('version と savedAt が付く', () => {
    const data = {
      active: 'x',
      progress: {},
      finished: {},
      session: { stage: 'article' as const, lastDocumentId: 'd1' },
      revision: 4,
    };
    const out = toSaveDataV3(data, now);
    expect(out).toEqual({ version: CURRENT_SAVE_VERSION, gameVersion: 2, savedAt: NOW, ...data });
    // 互換用の別名も最新形式で包む
    expect(toSaveDataV2(data, now)).toEqual(out);
  });
});
