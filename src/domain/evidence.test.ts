import { pinDocument, togglePin, unpinDocument } from './evidence';
import { makeProgress } from '../test/fixtures';

describe('evidence', () => {
  it('未閲覧の資料は採用できない', () => {
    const p = makeProgress();
    expect(pinDocument(p, 'a')).toBe(p);
  });
  it('閲覧済みの資料は採用でき、重複しない', () => {
    const p = makeProgress({ opened: ['a'] });
    const once = pinDocument(p, 'a');
    expect(once.pinned).toEqual(['a']);
    expect(pinDocument(once, 'a').pinned).toEqual(['a']);
  });
  it('取り下げると照合選択からも外れる', () => {
    const p = makeProgress({ opened: ['a', 'b'], pinned: ['a', 'b'], chosenLink: ['a', 'b'] });
    const q = unpinDocument(p, 'a');
    expect(q.pinned).toEqual(['b']);
    expect(q.chosenLink).toEqual(['b']);
  });
  it('toggle は採用と取り下げを切り替える', () => {
    const p = makeProgress({ opened: ['a'] });
    const on = togglePin(p, 'a');
    expect(on.pinned).toEqual(['a']);
    expect(togglePin(on, 'a').pinned).toEqual([]);
  });
});
