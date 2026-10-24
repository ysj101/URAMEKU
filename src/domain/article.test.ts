import { addFragment, countFragmentsInPlace, isArticleCorrect, removeFragmentAt } from './article';
import { makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

describe('article', () => {
  it('3つまで追加でき、重複しない', () => {
    let p = makeProgress();
    p = addFragment(p, 'f0');
    p = addFragment(p, 'f0');
    p = addFragment(p, 'f1');
    p = addFragment(p, 'f2');
    p = addFragment(p, 'f3');
    expect(p.article).toEqual(['f0', 'f1', 'f2']);
  });
  it('位置を指定して外せる', () => {
    const p = makeProgress({ article: ['f0', 'f1', 'f2'] });
    expect(removeFragmentAt(p, 1).article).toEqual(['f0', 'f2']);
    expect(removeFragmentAt(p, 5)).toBe(p);
  });
  it('順序が違えば不正解だが、正しい位置の数は数える', () => {
    const p = makeProgress({ article: ['f0', 'f2', 'f1'] });
    expect(isArticleCorrect(c, p)).toBe(false);
    expect(countFragmentsInPlace(c, p)).toBe(1);
  });
  it('3つ正しく並べば正解', () => {
    expect(isArticleCorrect(c, makeProgress({ article: ['f0', 'f1', 'f2'] }))).toBe(true);
  });
});
