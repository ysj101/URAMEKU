import { CASES } from './cases';
import {
  ACHIEVEMENTS,
  ENCYCLOPEDIA,
  assertAchievements,
  assertEncyclopedia,
  findAchievement,
  findEntry,
  isRelativeAssetPath,
} from './encyclopedia';

describe('図鑑データ（data/encyclopedia/ja.json）', () => {
  it('5 項目が読み込め、id が一意', () => {
    expect(ENCYCLOPEDIA).toHaveLength(5);
    expect(new Set(ENCYCLOPEDIA.map((e) => e.id)).size).toBe(5);
  });
  it('unlockCase はすべて実在する事件 ID', () => {
    const caseIds = new Set(CASES.map((c) => c.id));
    for (const e of ENCYCLOPEDIA) {
      expect(caseIds.has(e.unlockCase), `${e.id}: ${e.unlockCase}`).toBe(true);
    }
  });
  it('各事件にちょうど 1 項目が対応する', () => {
    const counts = new Map<string, number>();
    for (const e of ENCYCLOPEDIA) counts.set(e.unlockCase, (counts.get(e.unlockCase) ?? 0) + 1);
    for (const c of CASES) expect(counts.get(c.id), c.id).toBe(1);
  });
  it('art は public/ からの相対パス形式（存在確認は MVP-033）', () => {
    for (const e of ENCYCLOPEDIA) {
      expect(isRelativeAssetPath(e.art), e.art).toBe(true);
      expect(e.art.startsWith('assets/encyclopedia/')).toBe(true);
    }
  });
  it('title / summary / disclaimer が空でない', () => {
    for (const e of ENCYCLOPEDIA) {
      expect(e.title.trim()).not.toBe('');
      expect(e.summary.trim()).not.toBe('');
      expect(e.disclaimer.trim()).not.toBe('');
    }
  });
  it('findEntry', () => {
    expect(findEntry('framing')?.unlockCase).toBe('case-01');
    expect(findEntry('nope')).toBeUndefined();
  });
});

describe('実績データ（data/achievements.json）', () => {
  it('5 ルールが定義されている', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'first-evidence',
      'first-link',
      'number-check',
      'five-cases',
      'no-hint',
    ]);
  });
  it('icon は public/ からの相対パス形式', () => {
    for (const a of ACHIEVEMENTS) {
      expect(isRelativeAssetPath(a.icon), a.icon).toBe(true);
      expect(a.icon.startsWith('assets/achievements/')).toBe(true);
    }
  });
  it('findAchievement', () => {
    expect(findAchievement('five-cases')?.title).toBeTruthy();
    expect(findAchievement('nope')).toBeUndefined();
  });
});

describe('検証関数', () => {
  const entry = {
    id: 'x',
    title: 't',
    summary: 's',
    unlockCase: 'case-01',
    art: 'assets/x.png',
    disclaimer: 'd',
  };
  it('isRelativeAssetPath', () => {
    expect(isRelativeAssetPath('assets/a.png')).toBe(true);
    expect(isRelativeAssetPath('/assets/a.png')).toBe(false);
    expect(isRelativeAssetPath('../a.png')).toBe(false);
    expect(isRelativeAssetPath('assets/../a.png')).toBe(false);
    expect(isRelativeAssetPath('https://example.test/a.png')).toBe(false);
    expect(isRelativeAssetPath('')).toBe(false);
    expect(isRelativeAssetPath(' assets/a.png')).toBe(false);
  });
  it('不正な図鑑データは例外', () => {
    expect(() => assertEncyclopedia({})).toThrow();
    expect(() => assertEncyclopedia([{ ...entry, art: '/abs.png' }])).toThrow(/art/);
    expect(() => assertEncyclopedia([{ ...entry, unlockCase: '' }])).toThrow(/unlockCase/);
    expect(() => assertEncyclopedia([entry, entry])).toThrow(/重複/);
    expect(assertEncyclopedia([entry])).toEqual([entry]);
  });
  it('不正な実績データは例外', () => {
    const a = { id: 'a', title: 't', rule: 'r', icon: 'assets/a.png' };
    expect(() => assertAchievements('x')).toThrow();
    expect(() => assertAchievements([{ ...a, icon: 'http://x/a.png' }])).toThrow(/icon/);
    expect(() => assertAchievements([a, a])).toThrow(/重複/);
    expect(assertAchievements([a])).toEqual([a]);
  });
});
