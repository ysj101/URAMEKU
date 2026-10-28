import {
  canSubmitArticle,
  publishVerdict,
  submitArticle,
  VERDICT_TRACKS,
  withdrawArticle,
  type VerdictTrack,
} from './publish';
import { evaluateCase } from './scoring';
import type { CaseProgress } from './types';
import { clearedProgress, makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

/** 系統ごとの「満たす進行」を合成する部品 */
const parts: Record<VerdictTrack, Partial<CaseProgress>> = {
  evidence: { opened: ['a', 'b', 'c'] },
  link: { opened: ['a', 'b', 'c'], chosenLink: ['c', 'a'] },
  calculation: { calculations: { t1: '45', t2: '200' } },
  article: { article: ['f0', 'f1', 'f2'] },
};

function compose(tracks: VerdictTrack[]): CaseProgress {
  // link は閲覧済みを前提にするため、evidence 無しの link は opened を照合対象のみに絞る
  const p = makeProgress();
  const merged: CaseProgress = { ...p };
  for (const t of tracks) Object.assign(merged, parts[t]);
  if (tracks.includes('link') && !tracks.includes('evidence')) {
    merged.opened = ['a', 'c'];
  }
  return merged;
}

describe('publishVerdict: 4 系統の総当たり', () => {
  const combos: VerdictTrack[][] = [];
  for (let mask = 0; mask < 1 << VERDICT_TRACKS.length; mask++) {
    combos.push(VERDICT_TRACKS.filter((_, i) => mask & (1 << i)));
  }

  it.each(combos.map((t) => [t.join('+') || '(なし)', t] as const))('%s', (_label, tracks) => {
    const v = publishVerdict(c, compose(tracks));
    const expectedMissing = VERDICT_TRACKS.filter((t) => !tracks.includes(t));
    expect(v.missing).toEqual(expectedMissing);
    expect(v.approved).toBe(tracks.length === VERDICT_TRACKS.length);
    // evaluateCase().cleared は同じ判定を返す
    expect(evaluateCase(c, compose(tracks)).cleared).toBe(v.approved);
  });

  it('全部揃ったときだけ approved（16 通り中 1 通り）', () => {
    const approvedCount = combos.filter((t) => publishVerdict(c, compose(t)).approved).length;
    expect(approvedCount).toBe(1);
  });
});

describe('publishVerdict: 代表的な欠け方', () => {
  it('見出しだけ正答では不合格', () => {
    const v = publishVerdict(c, makeProgress({ article: ['f0', 'f1', 'f2'] }));
    expect(v.approved).toBe(false);
    expect(v.missing).toEqual(['evidence', 'link', 'calculation']);
    expect(v.detail.article).toEqual({ done: 3, total: 3 });
  });
  it('証拠と照合だけでは不合格', () => {
    const v = publishVerdict(c, compose(['evidence', 'link']));
    expect(v.approved).toBe(false);
    expect(v.missing).toEqual(['calculation', 'article']);
    expect(v.detail.evidence).toEqual({ done: 3, total: 3 });
    expect(v.detail.link).toEqual({ done: 1, total: 1 });
  });
  it('計算だけでは不合格', () => {
    const v = publishVerdict(c, compose(['calculation']));
    expect(v.missing).toEqual(['evidence', 'link', 'article']);
    expect(v.detail.calculation).toEqual({ done: 2, total: 2 });
  });
  it('3 系統揃って 1 系統欠けでも不合格（記事欠け）', () => {
    const v = publishVerdict(c, compose(['evidence', 'link', 'calculation']));
    expect(v.approved).toBe(false);
    expect(v.missing).toEqual(['article']);
  });
});

describe('publishVerdict: 部分達成の detail', () => {
  it('必要証拠が 2/3、計算 1/2、断片が位置ずれ', () => {
    const v = publishVerdict(
      c,
      makeProgress({
        opened: ['a', 'b'],
        chosenLink: ['a', 'b'],
        calculations: { t1: '45', t2: '199' },
        article: ['f1', 'f0', 'f2'],
      }),
    );
    expect(v.approved).toBe(false);
    expect(v.missing).toEqual(['evidence', 'link', 'calculation', 'article']);
    expect(v.detail).toEqual({
      evidence: { done: 2, total: 3 },
      link: { done: 0, total: 1 },
      calculation: { done: 1, total: 2 },
      article: { done: 1, total: 3 },
    });
  });
  it('許容誤差内の計算は正解扱い', () => {
    const p = {
      ...compose(['evidence', 'link', 'article']),
      calculations: { t1: '45.05', t2: '200' },
    };
    expect(publishVerdict(c, p).approved).toBe(true);
  });
});

describe('publishVerdict: UI 状態に依存しない', () => {
  it('published / revealed を変えても結果は同じ', () => {
    const base = clearedProgress();
    const variants: CaseProgress[] = [
      { ...base, published: false },
      { ...base, published: true, revealed: true },
    ];
    for (const p of variants) {
      expect(publishVerdict(c, p)).toEqual(publishVerdict(c, base));
    }
  });
  it('必要証拠が無い事件でも照合・計算・記事の 3 系統が揃えば合格（CaseData 定義に追従）', () => {
    const noEvidence = makeCase({ required_evidence: [] });
    const v = publishVerdict(noEvidence, compose(['link', 'calculation', 'article']));
    expect(v.detail.evidence).toEqual({ done: 0, total: 0 });
    expect(v.approved).toBe(true);
  });
});

describe('提出と差し戻しの往復', () => {
  it('3 断片揃えば合否に関係なく提出でき、取り下げて再提出できる', () => {
    const wrongArticle = makeProgress({ article: ['f2', 'f1', 'f0'] });
    expect(canSubmitArticle(wrongArticle)).toBe(true);
    expect(publishVerdict(c, wrongArticle).approved).toBe(false);

    const submitted = submitArticle(wrongArticle);
    expect(submitted.published).toBe(true);
    expect(canSubmitArticle(submitted)).toBe(false);
    expect(submitArticle(submitted)).toBe(submitted);

    const withdrawn = withdrawArticle(submitted);
    expect(withdrawn.published).toBe(false);
    expect(withdrawn.article).toEqual(['f2', 'f1', 'f0']);
    expect(withdrawArticle(withdrawn)).toBe(withdrawn);

    const fixed = { ...withdrawn, article: ['f0', 'f1', 'f2'] };
    expect(canSubmitArticle(fixed)).toBe(true);
    const resubmitted = submitArticle(fixed);
    expect(resubmitted.published).toBe(true);
    // 提出フラグは合否に影響しない
    expect(publishVerdict(c, resubmitted).missing).toEqual(['evidence', 'link', 'calculation']);
  });
  it('2 断片以下では提出できない', () => {
    const p = makeProgress({ article: ['f0', 'f1'] });
    expect(canSubmitArticle(p)).toBe(false);
    expect(submitArticle(p)).toBe(p);
  });
});
