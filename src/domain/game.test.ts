import { createProgress, normalizeProgress, reduceProgress } from './game';
import { makeCase } from '../test/fixtures';

const c = makeCase();

describe('game reducer', () => {
  it('一連の操作でクリアに到達できる', () => {
    let p = createProgress();
    for (const id of ['a', 'b', 'c']) {
      p = reduceProgress(c, p, { type: 'open-document', documentId: id });
    }
    p = reduceProgress(c, p, { type: 'toggle-link', documentId: 'a' });
    p = reduceProgress(c, p, { type: 'toggle-link', documentId: 'c' });
    p = reduceProgress(c, p, { type: 'set-calculation', taskId: 't1', value: '45' });
    p = reduceProgress(c, p, { type: 'set-calculation', taskId: 't2', value: '200' });
    for (const f of ['f0', 'f1', 'f2'])
      p = reduceProgress(c, p, { type: 'add-fragment', fragmentId: f });
    expect(p.published).toBe(false);
    p = reduceProgress(c, p, { type: 'submit' });
    expect(p.published).toBe(true);
  });
  it('断片が3つ揃うまで提出できない', () => {
    const p = reduceProgress(c, createProgress(), { type: 'submit' });
    expect(p.published).toBe(false);
  });
  it('reset で初期状態に戻る', () => {
    const p = reduceProgress(c, { ...createProgress(), opened: ['a'] }, { type: 'reset' });
    expect(p).toEqual(createProgress());
  });
  it('normalizeProgress は壊れた値を初期化する', () => {
    expect(normalizeProgress(null)).toEqual(createProgress());
    expect(normalizeProgress({ opened: 'x', calculations: { t1: 45 } })).toEqual({
      ...createProgress(),
      calculations: { t1: '45' },
    });
  });
});

describe('game reducer: toggle-link', () => {
  it('まだ読んでいない資料は toggle-link で選べない', () => {
    const p = reduceProgress(c, createProgress(), { type: 'toggle-link', documentId: 'a' });
    expect(p.chosenLink).toEqual([]);
  });
  it('提出済みでは toggle-link が無視される', () => {
    const base = {
      ...createProgress(),
      opened: ['a', 'b', 'c'],
      chosenLink: ['a'],
      article: ['f0', 'f1', 'f2'],
      published: true,
    };
    expect(reduceProgress(c, base, { type: 'toggle-link', documentId: 'c' })).toBe(base);
    expect(reduceProgress(c, base, { type: 'toggle-link', documentId: 'a' })).toBe(base);
  });
  it('同じ資料を2回 toggle-link すると解除される', () => {
    let p = { ...createProgress(), opened: ['a'] };
    p = reduceProgress(c, p, { type: 'toggle-link', documentId: 'a' });
    expect(p.chosenLink).toEqual(['a']);
    p = reduceProgress(c, p, { type: 'toggle-link', documentId: 'a' });
    expect(p.chosenLink).toEqual([]);
  });
});

describe('game reducer: 記事編集・復元（MVP-025）', () => {
  const withArticle = { ...createProgress(), article: ['f0', 'f1', 'f2'] };

  it('replace-fragment / move-fragment / clear-article が対応する関数に委譲される', () => {
    expect(
      reduceProgress(c, withArticle, { type: 'replace-fragment', index: 1, fragmentId: 'f4' })
        .article,
    ).toEqual(['f0', 'f4', 'f2']);
    expect(
      reduceProgress(c, withArticle, { type: 'move-fragment', from: 0, to: 2 }).article,
    ).toEqual(['f1', 'f2', 'f0']);
    expect(reduceProgress(c, withArticle, { type: 'clear-article' }).article).toEqual([]);
  });
  it('重複や 3 つ超えは reducer 経由でも拒否される', () => {
    expect(
      reduceProgress(c, withArticle, { type: 'replace-fragment', index: 0, fragmentId: 'f2' }),
    ).toBe(withArticle);
    expect(reduceProgress(c, withArticle, { type: 'add-fragment', fragmentId: 'f5' })).toBe(
      withArticle,
    );
  });
  it('提出して差し戻されても（withdraw）直前の 3 断片が残り、再提出できる', () => {
    let p = reduceProgress(c, withArticle, { type: 'submit' });
    expect(p.published).toBe(true);
    p = reduceProgress(c, p, { type: 'withdraw' });
    expect(p.published).toBe(false);
    expect(p.article).toEqual(['f0', 'f1', 'f2']);
    // 2 回目の試行: 1 つ差し替えて再提出
    p = reduceProgress(c, p, { type: 'replace-fragment', index: 2, fragmentId: 'f6' });
    p = reduceProgress(c, p, { type: 'submit' });
    expect(p).toMatchObject({ published: true, article: ['f0', 'f1', 'f6'] });
    // 3 回目: クリアして組み直す
    p = reduceProgress(c, p, { type: 'withdraw' });
    p = reduceProgress(c, p, { type: 'clear-article' });
    expect(p.article).toEqual([]);
    expect(reduceProgress(c, p, { type: 'submit' }).published).toBe(false);
  });
});
