import {
  addFragment,
  countFragmentsInPlace,
  fragmentFeedback,
  isArticleCorrect,
  removeFragmentAt,
} from './article';
import { publishVerdict } from './publish';
import { ARTICLE_LENGTH, FRAGMENT_KINDS, type HeadlineFragment } from './types';
import { CASES } from '../data/cases';
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

describe('実データの断片メタ情報', () => {
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
