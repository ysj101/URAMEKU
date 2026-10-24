import { deadEndReason, isDeadEnd, requiredDocumentIds } from './deadEnd';
import { makeCase, makeProgress } from '../test/fixtures';

// budget 3 / 必要資料 a,b,c（各 1）/ 外れ資料 d（2）/ 無料 free
const c = makeCase();

describe('requiredDocumentIds', () => {
  it('required_evidence と required_link の和集合を documents 順で返す', () => {
    const withFreeLink = makeCase({ required_link: ['free', 'a'] });
    expect(requiredDocumentIds(c)).toEqual(['a', 'b', 'c']);
    expect(requiredDocumentIds(withFreeLink)).toEqual(['free', 'a', 'b', 'c']);
  });
  it('documents に存在しない ID は無視する', () => {
    expect(requiredDocumentIds(makeCase({ required_link: ['a', 'ghost'] }))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('isDeadEnd', () => {
  it('初期状態は詰みではない', () => {
    expect(isDeadEnd(c, makeProgress())).toBe(false);
  });
  it('必要資料だけを開いていれば詰みではない', () => {
    expect(isDeadEnd(c, makeProgress({ opened: ['free', 'a', 'b'] }))).toBe(false);
    expect(isDeadEnd(c, makeProgress({ opened: ['a', 'b', 'c'] }))).toBe(false);
  });
  it('外れ資料で予算を使い、必要資料が開けなくなれば詰み', () => {
    expect(isDeadEnd(c, makeProgress({ opened: ['d'] }))).toBe(true);
  });
  it('必要資料をすべて開いた後は予算がゼロでも詰みではない', () => {
    expect(isDeadEnd(c, makeProgress({ opened: ['a', 'b', 'c'] }))).toBe(false);
  });
  it('無料資料が必要資料に含まれていても詰みの判定に影響しない', () => {
    const withFreeLink = makeCase({ required_link: ['free', 'a'] });
    expect(isDeadEnd(withFreeLink, makeProgress({ opened: ['a', 'b', 'c'] }))).toBe(false);
  });
  it('予算に余裕がある事件では外れ資料を開いても詰まない', () => {
    const roomy = makeCase({ budget: 5 });
    expect(isDeadEnd(roomy, makeProgress({ opened: ['d'] }))).toBe(false);
  });
});

describe('deadEndReason', () => {
  it('どの必要資料が開けないかと不足額を返す', () => {
    const r = deadEndReason(c, makeProgress({ opened: ['d', 'a'] }));
    expect(r.deadEnd).toBe(true);
    expect(r.remaining).toBe(0);
    expect(r.missing.map((d) => d.id)).toEqual(['b', 'c']);
    expect(r.missingCost).toBe(2);
    expect(r.shortfall).toBe(2);
  });
  it('詰みでないときは不足額 0', () => {
    const r = deadEndReason(c, makeProgress({ opened: ['a'] }));
    expect(r.deadEnd).toBe(false);
    expect(r.remaining).toBe(2);
    expect(r.missing.map((d) => d.id)).toEqual(['b', 'c']);
    expect(r.shortfall).toBe(0);
  });
});
