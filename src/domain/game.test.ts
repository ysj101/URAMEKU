import { createProgress, normalizeProgress, reduceProgress } from './game';
import { makeCase } from '../test/fixtures';

const c = makeCase();

describe('game reducer', () => {
  it('一連の操作でクリアに到達できる', () => {
    let p = createProgress();
    for (const id of ['a', 'b', 'c']) {
      p = reduceProgress(c, p, { type: 'open-document', documentId: id });
      p = reduceProgress(c, p, { type: 'toggle-pin', documentId: id });
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
    expect(normalizeProgress({ opened: 'x', pinned: [1, 'a'], calculations: { t1: 45 } })).toEqual({
      ...createProgress(),
      pinned: ['a'],
      calculations: { t1: '45' },
    });
  });
});

describe('game reducer: toggle-link', () => {
  it('ボード未採用の資料は toggle-link で選べない', () => {
    const p = reduceProgress(
      c,
      { ...createProgress(), opened: ['a'] },
      { type: 'toggle-link', documentId: 'a' },
    );
    expect(p.chosenLink).toEqual([]);
  });
  it('提出済みでは toggle-link が無視される', () => {
    const base = {
      ...createProgress(),
      opened: ['a', 'b', 'c'],
      pinned: ['a', 'b', 'c'],
      chosenLink: ['a'],
      article: ['f0', 'f1', 'f2'],
      published: true,
    };
    expect(reduceProgress(c, base, { type: 'toggle-link', documentId: 'c' })).toBe(base);
    expect(reduceProgress(c, base, { type: 'toggle-link', documentId: 'a' })).toBe(base);
  });
  it('同じ資料を2回 toggle-link すると解除される', () => {
    let p = { ...createProgress(), opened: ['a'], pinned: ['a'] };
    p = reduceProgress(c, p, { type: 'toggle-link', documentId: 'a' });
    expect(p.chosenLink).toEqual(['a']);
    p = reduceProgress(c, p, { type: 'toggle-link', documentId: 'a' });
    expect(p.chosenLink).toEqual([]);
  });
});
