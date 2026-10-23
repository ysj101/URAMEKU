import { canOpenDocument, openDocument, remainingBudget } from './budget';
import { makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

describe('budget', () => {
  it('初期状態の残予算は budget と等しい', () => {
    expect(remainingBudget(c, makeProgress())).toBe(3);
  });
  it('無料資料を開いても予算は減らない', () => {
    const p = openDocument(c, makeProgress(), 'free');
    expect(p.opened).toEqual(['free']);
    expect(remainingBudget(c, p)).toBe(3);
  });
  it('有料資料を2度開いても初回のみ消費する', () => {
    const p1 = openDocument(c, makeProgress(), 'a');
    const p2 = openDocument(c, p1, 'a');
    expect(p2).toBe(p1);
    expect(remainingBudget(c, p2)).toBe(2);
  });
  it('予算超過の資料は開けず状態も変わらない', () => {
    const p = makeProgress({ opened: ['a', 'b'] });
    expect(remainingBudget(c, p)).toBe(1);
    expect(canOpenDocument(c, p, 'd')).toBe(false);
    expect(openDocument(c, p, 'd')).toBe(p);
    expect(canOpenDocument(c, p, 'c')).toBe(true);
  });
  it('存在しない資料は開けない', () => {
    expect(canOpenDocument(c, makeProgress(), 'nope')).toBe(false);
  });
});
