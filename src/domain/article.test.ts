import {
  addFragment,
  clearArticle,
  countFragmentsInPlace,
  fragmentFeedback,
  isArticleCorrect,
  moveFragment,
  removeFragmentAt,
  replaceFragmentAt,
} from './article';
import { publishVerdict } from './publish';
import { ARTICLE_LENGTH, FRAGMENT_KINDS, type HeadlineFragment } from './types';
import { LEGACY_CASES as CASES } from '../test/legacyCases';
import { clearedProgress, makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

/** kind / reason 付きの断片を持つケース（f0-f2 が正解） */
const annotated = makeCase({
  headline_fragments: [
    { id: 'f0', text: '正解0', kind: 'correct', reason: '正しい理由0', evidence: ['a'] },
    { id: 'f1', text: '正解1', kind: 'correct', reason: '正しい理由1', evidence: ['b'] },
    { id: 'f2', text: '正解2', kind: 'correct', reason: '正しい理由2', evidence: ['c'] },
    {
      id: 'f3',
      text: '誤り3',
      kind: 'overgeneralization',
      reason: '一般化しすぎ',
      evidence: ['a'],
    },
    { id: 'f4', text: '誤り4', kind: 'misread-statistic', reason: '統計の誤読', evidence: ['b'] },
    { id: 'f5', text: '誤り5', kind: 'causal-claim', reason: '原因の断定', evidence: ['c'] },
    { id: 'f6', text: '誤り6', kind: 'ignored-counter-evidence', reason: '反対資料の無視' },
    { id: 'f7', text: '誤り7' },
  ],
});

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

describe('fragmentFeedback', () => {
  it('採点対象は常に 3 スロットで、4 つ目以降は存在しない', () => {
    expect(ARTICLE_LENGTH).toBe(3);
    for (const article of [[], ['f0'], ['f0', 'f1', 'f2']]) {
      const fb = fragmentFeedback(annotated, makeProgress({ article }));
      expect(fb).toHaveLength(3);
      expect(fb.map((f) => f.index)).toEqual([0, 1, 2]);
    }
    // 保存データが何らかの理由で 4 件持っていても採点は 3 スロットに閉じる
    const fb = fragmentFeedback(annotated, makeProgress({ article: ['f0', 'f1', 'f2', 'f3'] }));
    expect(fb).toHaveLength(3);
    expect(fb.find((f) => f.fragmentId === 'f3')).toBeUndefined();
  });

  it('空スロットは empty（kind / reason なし）', () => {
    const fb = fragmentFeedback(annotated, makeProgress({ article: ['f0'] }));
    expect(fb[1]).toEqual({ index: 1, status: 'empty' });
    expect(fb[2]).toEqual({ index: 2, status: 'empty' });
  });

  it('正しい位置なら correct、正しい断片でも位置違いなら wrong-position', () => {
    const fb = fragmentFeedback(annotated, makeProgress({ article: ['f0', 'f2', 'f1'] }));
    expect(fb.map((f) => f.status)).toEqual(['correct', 'wrong-position', 'wrong-position']);
    expect(fb[0]).toMatchObject({ fragmentId: 'f0', kind: 'correct', reason: '正しい理由0' });
    expect(fb[1]).toMatchObject({ fragmentId: 'f2', kind: 'correct', evidence: ['c'] });
  });

  it('誤った断片は incorrect になり、kind / reason / evidence を転記する', () => {
    const fb = fragmentFeedback(annotated, makeProgress({ article: ['f3', 'f1', 'f6'] }));
    expect(fb[0]).toEqual({
      index: 0,
      fragmentId: 'f3',
      status: 'incorrect',
      kind: 'overgeneralization',
      reason: '一般化しすぎ',
      evidence: ['a'],
    });
    expect(fb[1]?.status).toBe('correct');
    expect(fb[2]).toEqual({
      index: 2,
      fragmentId: 'f6',
      status: 'incorrect',
      kind: 'ignored-counter-evidence',
      reason: '反対資料の無視',
    });
  });

  it('kind / reason の無い断片でも採点はできる', () => {
    const fb = fragmentFeedback(annotated, makeProgress({ article: ['f7'] }));
    expect(fb[0]).toEqual({ index: 0, fragmentId: 'f7', status: 'incorrect' });
    const plain = fragmentFeedback(c, makeProgress({ article: ['f1', 'f0', 'f5'] }));
    expect(plain.map((f) => f.status)).toEqual(['wrong-position', 'wrong-position', 'incorrect']);
    expect(plain.every((f) => f.kind === undefined && f.reason === undefined)).toBe(true);
  });

  it('判定は correct_fragments に従い、断片の kind では判定しない', () => {
    const inconsistent = makeCase({
      headline_fragments: [
        { id: 'f0', text: '0', kind: 'other' },
        ...Array.from({ length: 7 }, (_, i) => ({ id: `f${i + 1}`, text: `${i + 1}` })),
      ],
    });
    const fb = fragmentFeedback(inconsistent, makeProgress({ article: ['f0'] }));
    expect(fb[0]?.status).toBe('correct');
    expect(fb[0]?.kind).toBe('other');
  });

  it('戻り値の evidence を書き換えてもケースデータは変わらない', () => {
    const fb = fragmentFeedback(annotated, makeProgress({ article: ['f3'] }));
    fb[0]?.evidence?.push('zzz');
    expect(annotated.headline_fragments[3]?.evidence).toEqual(['a']);
  });
});

describe('単独正解ではクリアにならない', () => {
  const cleared = clearedProgress();

  it('正しい断片が 1 つだけでは article 系統が未達で approved にならない', () => {
    for (const article of [
      ['f0', 'f3', 'f4'],
      ['f3', 'f1', 'f4'],
      ['f3', 'f4', 'f2'],
    ]) {
      const p = makeProgress({ ...cleared, article });
      const v = publishVerdict(annotated, p);
      expect(countFragmentsInPlace(annotated, p)).toBe(1);
      expect(isArticleCorrect(annotated, p)).toBe(false);
      expect(v.detail.article).toEqual({ done: 1, total: 3 });
      expect(v.missing).toEqual(['article']);
      expect(v.approved).toBe(false);
      expect(fragmentFeedback(annotated, p).filter((f) => f.status === 'correct')).toHaveLength(1);
    }
  });

  it('正しい 3 断片でも順序が違えば approved にならない', () => {
    const p = makeProgress({ ...cleared, article: ['f1', 'f0', 'f2'] });
    const v = publishVerdict(annotated, p);
    expect(v.detail.article).toEqual({ done: 1, total: 3 });
    expect(v.approved).toBe(false);
    expect(fragmentFeedback(annotated, p).map((f) => f.status)).toEqual([
      'wrong-position',
      'wrong-position',
      'correct',
    ]);
  });

  it('3 断片が正しく並んで初めて approved', () => {
    const v = publishVerdict(annotated, cleared);
    expect(v.detail.article).toEqual({ done: 3, total: 3 });
    expect(v.approved).toBe(true);
    expect(fragmentFeedback(annotated, cleared).every((f) => f.status === 'correct')).toBe(true);
  });
});

describe('V1互換fixtureの断片メタ情報', () => {
  for (const data of CASES) {
    describe(data.id, () => {
      const correct = new Set(data.correct_fragments);
      const docIds = new Set(data.documents.map((d) => d.id));
      const byId = new Map(data.headline_fragments.map((f) => [f.id, f]));

      it('全断片に kind / reason / evidence がある', () => {
        for (const f of data.headline_fragments) {
          expect(FRAGMENT_KINDS, `${f.id}.kind`).toContain(f.kind);
          expect(f.reason, `${f.id}.reason`).toBeTruthy();
          expect(f.evidence?.length, `${f.id}.evidence`).toBeGreaterThan(0);
          for (const e of f.evidence ?? []) expect(docIds.has(e), `${f.id} -> ${e}`).toBe(true);
        }
      });

      it('kind: correct と correct_fragments が両方向で一致する', () => {
        const kindCorrect = data.headline_fragments.filter((f) => f.kind === 'correct');
        expect(kindCorrect.map((f) => f.id).sort()).toEqual([...correct].sort());
        for (const id of correct) expect(byId.get(id)?.kind, id).toBe('correct');
        for (const f of data.headline_fragments) {
          if (!correct.has(f.id)) expect(f.kind, f.id).not.toBe('correct');
        }
      });

      it('正解 3 断片だけを正しく並べると全スロット correct', () => {
        const fb = fragmentFeedback(data, makeProgress({ article: data.correct_fragments }));
        expect(fb.map((f) => f.status)).toEqual(['correct', 'correct', 'correct']);
        const wrong: HeadlineFragment[] = data.headline_fragments.filter((f) => !correct.has(f.id));
        expect(wrong).toHaveLength(5);
        const fbWrong = fragmentFeedback(
          data,
          makeProgress({ article: wrong.slice(0, 3).map((f) => f.id) }),
        );
        expect(fbWrong.every((f) => f.status === 'incorrect' && f.reason)).toBe(true);
      });
    });
  }
});

describe('article: 編集操作（MVP-025）', () => {
  const full = makeProgress({ article: ['f0', 'f1', 'f2'] });

  it('replaceFragmentAt はスロットの断片を差し替える', () => {
    expect(replaceFragmentAt(full, 1, 'f5').article).toEqual(['f0', 'f5', 'f2']);
    expect(replaceFragmentAt(full, 0, 'f7').article).toEqual(['f7', 'f1', 'f2']);
  });
  it('replaceFragmentAt は別スロットで使用中の断片を拒否する（重複不可）', () => {
    expect(replaceFragmentAt(full, 1, 'f0')).toBe(full);
    expect(replaceFragmentAt(full, 1, 'f1')).toBe(full);
  });
  it('replaceFragmentAt は空スロット直後なら追加として扱い、3 つ超えは不可', () => {
    const one = makeProgress({ article: ['f0'] });
    expect(replaceFragmentAt(one, 1, 'f3').article).toEqual(['f0', 'f3']);
    // 歯抜けにはしない（index 2 を指定しても末尾に追加）
    expect(replaceFragmentAt(one, 2, 'f3').article).toEqual(['f0', 'f3']);
    expect(replaceFragmentAt(full, 3, 'f3')).toBe(full);
    expect(replaceFragmentAt(full, -1, 'f3')).toBe(full);
    expect(replaceFragmentAt(full, 1.5, 'f3')).toBe(full);
  });
  it('moveFragment は順序を入れ替える', () => {
    expect(moveFragment(full, 0, 1).article).toEqual(['f1', 'f0', 'f2']);
    expect(moveFragment(full, 2, 0).article).toEqual(['f2', 'f0', 'f1']);
    expect(moveFragment(full, 0, 2).article).toEqual(['f1', 'f2', 'f0']);
  });
  it('moveFragment は範囲外・同一位置では変更しない', () => {
    expect(moveFragment(full, 0, 0)).toBe(full);
    expect(moveFragment(full, 0, 3)).toBe(full);
    expect(moveFragment(full, -1, 0)).toBe(full);
    const two = makeProgress({ article: ['f0', 'f1'] });
    expect(moveFragment(two, 1, 2)).toBe(two);
    expect(moveFragment(two, 1, 0).article).toEqual(['f1', 'f0']);
  });
  it('clearArticle は 3 スロットを空にし、他の進行は保つ', () => {
    const p = makeProgress({ article: ['f0', 'f1'], pinned: ['a'] });
    expect(clearArticle(p)).toEqual({ ...p, article: [] });
    const empty = makeProgress();
    expect(clearArticle(empty)).toBe(empty);
  });
  it('入れ替え・差し替え・外す・クリアを繰り返しても状態が整合する', () => {
    let p = makeProgress();
    p = addFragment(p, 'f3');
    p = addFragment(p, 'f0');
    p = addFragment(p, 'f1');
    p = replaceFragmentAt(p, 0, 'f2'); // f2 f0 f1
    p = moveFragment(p, 0, 2); // f0 f1 f2
    expect(p.article).toEqual(['f0', 'f1', 'f2']);
    p = removeFragmentAt(p, 1); // f0 f2
    p = addFragment(p, 'f1'); // f0 f2 f1
    p = moveFragment(p, 2, 1); // f0 f1 f2
    expect(isArticleCorrect(c, p)).toBe(true);
    p = clearArticle(p);
    expect(p.article).toEqual([]);
    expect(new Set(p.article).size).toBe(p.article.length);
  });
});
