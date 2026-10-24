import { evaluateCase } from './scoring';
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
