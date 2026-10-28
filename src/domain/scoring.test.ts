import { evaluateCase, failureReasons } from './scoring';
import { clearedProgress, makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

describe('scoring', () => {
  it('全部正答で掲載承認、100点満点の内訳が合う', () => {
    const r = evaluateCase(c, clearedProgress());
    expect(r.cleared).toBe(true);
    // 24 + 20 + 26 + 24 + min(6, 残予算0*2)=0
    expect(r.points).toBe(94);
  });
  it('見出しだけ正答では承認されない', () => {
    const r = evaluateCase(c, makeProgress({ article: ['f0', 'f1', 'f2'] }));
    expect(r.cleared).toBe(false);
    expect(r.points).toBe(24 + 6);
  });
  it('残予算は最大6点まで', () => {
    const r = evaluateCase(makeCase({ budget: 10 }), makeProgress());
    expect(r.points).toBe(6);
  });
});

describe('breakdown', () => {
  const cases = [
    makeProgress(),
    makeProgress({ article: ['f0', 'f1', 'f2'] }),
    makeProgress({ opened: ['a'], calculations: { t1: '45' } }),
    clearedProgress(),
  ];
  it.each(cases.map((p, i) => [i, p] as const))(
    '系統ごとの earned の合計が points と一致する (%i)',
    (_i, p) => {
      const r = evaluateCase(c, p);
      expect(r.breakdown.reduce((s, row) => s + row.earned, 0)).toBe(r.points);
      expect(r.breakdown.map((row) => row.track)).toEqual([
        'evidence',
        'link',
        'calculation',
        'article',
        'budget',
      ]);
      expect(r.breakdown.reduce((s, row) => s + row.max, 0)).toBe(100);
      r.breakdown.forEach((row) => expect(row.earned).toBeLessThanOrEqual(row.max));
    },
  );
});

describe('failureReasons', () => {
  const base = clearedProgress();

  it('合格時は空', () => {
    expect(failureReasons(c, base)).toEqual([]);
  });

  it('証拠だけ不足 → evidence の理由のみ（件数を示し、資料名は出さない）', () => {
    const reasons = failureReasons(c, { ...base, opened: ['a', 'c'] });
    expect(reasons.map((r) => r.track)).toEqual(['evidence']);
    expect(reasons[0]!.message).toContain('1 件');
    expect(reasons[0]!.message).not.toContain('資料B');
  });

  it('照合だけ不成立 → link の理由のみ', () => {
    const reasons = failureReasons(c, { ...base, chosenLink: ['a', 'b'] });
    expect(reasons.map((r) => r.track)).toEqual(['link']);
    expect(reasons[0]!.message).not.toMatch(/資料[ABC]/);
  });

  it('数値検証だけ誤り → calculation の理由のみ（問数を示し、正答値は出さない）', () => {
    const reasons = failureReasons(c, { ...base, calculations: { t1: '45', t2: '999' } });
    expect(reasons.map((r) => r.track)).toEqual(['calculation']);
    expect(reasons[0]!.message).toContain('1 問');
    expect(reasons[0]!.message).not.toContain('200');
  });

  it('見出しだけ誤り → article の理由のみ（断片の文言は出さない）', () => {
    const reasons = failureReasons(c, { ...base, article: ['f1', 'f0', 'f2'] });
    expect(reasons.map((r) => r.track)).toEqual(['article']);
    expect(reasons[0]!.message).toContain('順序');
    expect(reasons[0]!.message).not.toContain('断片0');
  });

  it('見出しが揃っていない場合は数の不足を伝える', () => {
    const reasons = failureReasons(c, { ...base, article: ['f0'] });
    expect(reasons.map((r) => r.track)).toEqual(['article']);
    expect(reasons[0]!.message).toContain('3 つ揃っていません');
  });

  it('複数不足なら VERDICT_TRACKS の順で並ぶ', () => {
    const reasons = failureReasons(c, makeProgress());
    expect(reasons.map((r) => r.track)).toEqual(['evidence', 'link', 'calculation', 'article']);
  });
});
