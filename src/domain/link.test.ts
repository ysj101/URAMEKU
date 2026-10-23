import { isLinkComplete, isLinkCorrect, toggleLinkSelection } from './link';
import { makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

describe('link', () => {
  it('ボード未採用の資料は選べない', () => {
    const p = makeProgress({ opened: ['a'] });
    expect(toggleLinkSelection(p, 'a')).toBe(p);
  });
  it('2枚選ぶと照合が成立し、順序は問わない', () => {
    const p = makeProgress({ opened: ['a', 'c'], pinned: ['a', 'c'] });
    const q = toggleLinkSelection(toggleLinkSelection(p, 'c'), 'a');
    expect(isLinkComplete(q)).toBe(true);
    expect(isLinkCorrect(c, q)).toBe(true);
  });
  it('同じ資料は2枚として数えない（自己照合不可）', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'], chosenLink: ['a', 'a'] });
    expect(isLinkComplete(p)).toBe(false);
    expect(isLinkCorrect(c, p)).toBe(false);
  });
  it('3枚目を押すと選び直しになる', () => {
    const p = makeProgress({
      opened: ['a', 'b', 'c'],
      pinned: ['a', 'b', 'c'],
      chosenLink: ['a', 'b'],
    });
    expect(toggleLinkSelection(p, 'c').chosenLink).toEqual(['c']);
  });
  it('誤った組み合わせは不正解', () => {
    const p = makeProgress({ opened: ['a', 'b'], pinned: ['a', 'b'], chosenLink: ['a', 'b'] });
    expect(isLinkCorrect(c, p)).toBe(false);
  });
});
