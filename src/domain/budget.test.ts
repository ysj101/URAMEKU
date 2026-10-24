import {
  affordableDocuments,
  canOpenDocument,
  documentCost,
  isDeadEnd,
  openDocument,
  remainingBudget,
  spentBudget,
  tryOpenDocument,
  unopenedRequiredDocuments,
} from './budget';
import type { CaseData } from './types';
import { makeCase, makeProgress } from '../test/fixtures';

// 予算 3 / free:0, a:1, b:1, c:1, d:2 / 必要証拠 a,b,c
const c = makeCase();
const ids = (docs: { id: string }[]) => docs.map((d) => d.id);

describe('budget: 残予算と消費', () => {
  it('初期状態の残予算は budget と等しい（GAME_RULES 2章: 事件ごとの予算）', () => {
    expect(spentBudget(c, makeProgress())).toBe(0);
    expect(remainingBudget(c, makeProgress())).toBe(3);
  });
  it('無料資料を開いても予算は減らない', () => {
    const p = openDocument(c, makeProgress(), 'free');
    expect(p.opened).toEqual(['free']);
    expect(remainingBudget(c, p)).toBe(3);
  });
  it('予算ちょうどを使い切ると残予算 0 になり、有料資料は開けない', () => {
    let p = makeProgress();
    p = openDocument(c, p, 'a');
    p = openDocument(c, p, 'd');
    expect(spentBudget(c, p)).toBe(3);
    expect(remainingBudget(c, p)).toBe(0);
    expect(canOpenDocument(c, p, 'b')).toBe(false);
  });
  it('残予算がコストちょうどなら開ける（>= 判定）', () => {
    const p = makeProgress({ opened: ['a'] }); // 残 2
    expect(canOpenDocument(c, p, 'd')).toBe(true);
    expect(remainingBudget(c, openDocument(c, p, 'd'))).toBe(0);
  });
  it('予算超過の資料は開けず状態も変わらない（GAME_RULES 2章: 不足すれば別の資料が開けなくなる）', () => {
    const p = makeProgress({ opened: ['a', 'b'] });
    expect(remainingBudget(c, p)).toBe(1);
    expect(canOpenDocument(c, p, 'd')).toBe(false);
    expect(openDocument(c, p, 'd')).toBe(p);
    expect(canOpenDocument(c, p, 'c')).toBe(true);
  });
  it('残予算は負にならない', () => {
    let p = makeProgress();
    for (const id of ['a', 'b', 'c', 'd']) p = openDocument(c, p, id);
    expect(p.opened).toEqual(['a', 'b', 'c']);
    expect(remainingBudget(c, p)).toBe(0);
  });
});

describe('budget: 再読込', () => {
  it('有料資料を2度開いても初回のみ消費する（GAME_RULES 2章: 再読でコスト消費なし）', () => {
    const p1 = openDocument(c, makeProgress(), 'a');
    const p2 = openDocument(c, p1, 'a');
    expect(p2).toBe(p1);
    expect(remainingBudget(c, p2)).toBe(2);
  });
  it('閲覧済み資料は残予算 0 でも開ける（再読はコスト 0）', () => {
    const p = makeProgress({ opened: ['a', 'd'] });
    expect(remainingBudget(c, p)).toBe(0);
    expect(canOpenDocument(c, p, 'd')).toBe(true);
    expect(tryOpenDocument(c, p, 'd')).toEqual({ progress: p, outcome: 'already-open' });
  });
  it('opened に重複があっても二重に消費しない', () => {
    const p = makeProgress({ opened: ['a', 'a', 'd', 'd'] });
    expect(spentBudget(c, p)).toBe(3);
  });
});

describe('budget: コスト 0 の資料', () => {
  it('予算 0 の事件でもコスト 0 の資料は開ける', () => {
    const zero = makeCase({ budget: 0 });
    const r = tryOpenDocument(zero, makeProgress(), 'free');
    expect(r.outcome).toBe('opened');
    expect(r.progress.opened).toEqual(['free']);
    expect(remainingBudget(zero, r.progress)).toBe(0);
    expect(tryOpenDocument(zero, makeProgress(), 'a').outcome).toBe('insufficient-budget');
  });
});

describe('budget: tryOpenDocument の結果', () => {
  it('開けたときは新しい進行状態と opened を返す', () => {
    const p = makeProgress();
    const r = tryOpenDocument(c, p, 'a');
    expect(r.outcome).toBe('opened');
    expect(r.progress).not.toBe(p);
    expect(r.progress.opened).toEqual(['a']);
    expect(p.opened).toEqual([]);
  });
  it('予算不足は insufficient-budget で同じ参照を返す', () => {
    const p = makeProgress({ opened: ['a', 'b'] });
    expect(tryOpenDocument(c, p, 'd')).toEqual({ progress: p, outcome: 'insufficient-budget' });
    expect(tryOpenDocument(c, p, 'd').progress).toBe(p);
  });
  it('存在しない資料は unknown-document で同じ参照を返す', () => {
    const p = makeProgress();
    expect(tryOpenDocument(c, p, 'nope')).toEqual({ progress: p, outcome: 'unknown-document' });
    expect(canOpenDocument(c, p, 'nope')).toBe(false);
    expect(openDocument(c, p, 'nope')).toBe(p);
  });
  it('openDocument / canOpenDocument は tryOpenDocument と整合する', () => {
    const p = makeProgress({ opened: ['a'] });
    for (const id of ['free', 'a', 'b', 'd', 'nope']) {
      const r = tryOpenDocument(c, p, id);
      expect(openDocument(c, p, id)).toEqual(r.progress);
      if (r.outcome !== 'opened') expect(openDocument(c, p, id)).toBe(p);
      expect(canOpenDocument(c, p, id)).toBe(
        r.outcome === 'opened' || r.outcome === 'already-open',
      );
    }
  });
});

describe('budget: opened の順序保持', () => {
  it('開いた順に末尾へ追加され、既存の順序は変わらない', () => {
    let p = makeProgress();
    p = openDocument(c, p, 'c');
    p = openDocument(c, p, 'free');
    p = openDocument(c, p, 'c'); // 再読は追加しない
    p = openDocument(c, p, 'a');
    expect(p.opened).toEqual(['c', 'free', 'a']);
  });
  it('開けなかったときは opened を変更しない', () => {
    const p = makeProgress({ opened: ['b', 'a'] });
    expect(openDocument(c, p, 'd').opened).toEqual(['b', 'a']);
    expect(openDocument(c, p, 'nope').opened).toEqual(['b', 'a']);
  });
});

describe('budget: 不正データ耐性', () => {
  it('opened に存在しない ID が混ざっていても計算が壊れない', () => {
    const p = makeProgress({ opened: ['ghost', 'a', 'deleted-doc'] });
    expect(spentBudget(c, p)).toBe(1);
    expect(remainingBudget(c, p)).toBe(2);
    expect(canOpenDocument(c, p, 'd')).toBe(true);
    expect(openDocument(c, p, 'b').opened).toEqual(['ghost', 'a', 'deleted-doc', 'b']);
    expect(ids(affordableDocuments(c, p))).toEqual(['free', 'b', 'c', 'd']);
    expect(isDeadEnd(c, p)).toBe(false);
  });
  it('負・非整数・NaN のコストは 0 として扱い例外にしない（検証は validateCase 側）', () => {
    expect(documentCost({ cost: -1 })).toBe(0);
    expect(documentCost({ cost: 1.5 })).toBe(0);
    expect(documentCost({ cost: Number.NaN })).toBe(0);
    expect(documentCost({ cost: Number.POSITIVE_INFINITY })).toBe(0);
    expect(documentCost({ cost: 'two' as unknown as number })).toBe(0);
    expect(documentCost({ cost: 2 })).toBe(2);

    const weird = makeCase({
      documents: [
        { id: 'neg', title: '負', content: 'x', cost: -5, visual: 'advert' },
        { id: 'frac', title: '小数', content: 'x', cost: 1.5, visual: 'advert' },
        { id: 'nan', title: 'NaN', content: 'x', cost: Number.NaN, visual: 'advert' },
        { id: 'a', title: 'A', content: 'x', cost: 1, visual: 'advert' },
      ],
      required_evidence: ['neg', 'a'],
    });
    const p0 = makeProgress();
    expect(() => remainingBudget(weird, p0)).not.toThrow();
    let p = openDocument(weird, p0, 'neg');
    p = openDocument(weird, p, 'frac');
    p = openDocument(weird, p, 'nan');
    expect(p.opened).toEqual(['neg', 'frac', 'nan']);
    expect(spentBudget(weird, p)).toBe(0);
    expect(remainingBudget(weird, p)).toBe(3);
    expect(isDeadEnd(weird, p)).toBe(false);
  });
  it('事件予算が不正でも例外にせず 0 として扱う', () => {
    const broken = { ...c, budget: Number.NaN } as CaseData;
    expect(remainingBudget(broken, makeProgress())).toBe(0);
    expect(tryOpenDocument(broken, makeProgress(), 'free').outcome).toBe('opened');
    expect(tryOpenDocument(broken, makeProgress(), 'a').outcome).toBe('insufficient-budget');
  });
  it('required_evidence に存在しない ID があっても無視する', () => {
    const data = makeCase({ required_evidence: ['a', 'missing'] });
    expect(ids(unopenedRequiredDocuments(data, makeProgress()))).toEqual(['a']);
    expect(isDeadEnd(data, makeProgress({ opened: ['a'] }))).toBe(false);
  });
});

describe('budget: affordableDocuments', () => {
  it('初期状態ではすべての資料が開ける（事件データの並び順）', () => {
    expect(ids(affordableDocuments(c, makeProgress()))).toEqual(['free', 'a', 'b', 'c', 'd']);
  });
  it('閲覧済みは除外し、残予算を超える資料も除外する', () => {
    const p = makeProgress({ opened: ['a', 'b'] }); // 残 1
    expect(ids(affordableDocuments(c, p))).toEqual(['free', 'c']);
  });
  it('予算を使い切ってもコスト 0 の未閲覧資料は残る', () => {
    const p = makeProgress({ opened: ['a', 'd'] }); // 残 0
    expect(ids(affordableDocuments(c, p))).toEqual(['free']);
  });
  it('すべて閲覧済みなら空', () => {
    const p = makeProgress({ opened: ['free', 'a', 'b', 'c'] });
    expect(affordableDocuments(c, p)).toEqual([]);
  });
});

describe('budget: isDeadEnd', () => {
  it('初期状態は行き詰まりではない', () => {
    expect(isDeadEnd(c, makeProgress())).toBe(false);
  });
  it('必要証拠をちょうど開ける残予算なら行き詰まりではない', () => {
    const p = makeProgress({ opened: ['a'] }); // 残 2、未閲覧必要証拠 b,c = 2
    expect(isDeadEnd(c, p)).toBe(false);
  });
  it('不要な高額資料に使って必要証拠が 1 点でも開けなくなれば行き詰まり', () => {
    const p = makeProgress({ opened: ['d', 'a'] }); // 残 0、未閲覧必要証拠 b,c
    expect(isDeadEnd(c, p)).toBe(true);
  });
  it('単体では開けても未閲覧必要証拠の合計が残予算を超えれば行き詰まり', () => {
    const p = makeProgress({ opened: ['d'] }); // 残 1、未閲覧必要証拠 a,b,c = 3
    expect(ids(affordableDocuments(c, p))).toEqual(['free', 'a', 'b', 'c']);
    expect(isDeadEnd(c, p)).toBe(true);
  });
  it('必要証拠をすべて閲覧済みなら残予算 0 でも行き詰まりではない', () => {
    const p = makeProgress({ opened: ['a', 'b', 'c'] });
    expect(remainingBudget(c, p)).toBe(0);
    expect(isDeadEnd(c, p)).toBe(false);
  });
  it('必要証拠がコスト 0 だけなら予算 0 でも行き詰まりではない', () => {
    const data = makeCase({ budget: 0, required_evidence: ['free'] });
    expect(isDeadEnd(data, makeProgress())).toBe(false);
  });
  it('事件リセット（opened 空）で行き詰まりが解消する', () => {
    const stuck = makeProgress({ opened: ['d', 'a'] });
    expect(isDeadEnd(c, stuck)).toBe(true);
    expect(isDeadEnd(c, makeProgress())).toBe(false);
  });
});
