import {
  canSelectForLink,
  isLinkComplete,
  isLinkCorrect,
  linkStatus,
  toggleLinkSelection,
} from './link';
import { CASES } from '../data/cases';
import { makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

describe('link: 選択可否', () => {
  it('ボード未採用の資料は選べない（not-pinned）', () => {
    const p = makeProgress({ opened: ['a'] });
    expect(canSelectForLink(c, p, 'a')).toEqual({ ok: false, reason: 'not-pinned' });
    expect(toggleLinkSelection(c, p, 'a')).toBe(p);
  });
  it('ケースに存在しない資料は選べない（unknown-document）', () => {
    const p = makeProgress({ opened: ['zzz'], pinned: ['zzz'] });
    expect(canSelectForLink(c, p, 'zzz')).toEqual({ ok: false, reason: 'unknown-document' });
    expect(toggleLinkSelection(c, p, 'zzz')).toBe(p);
  });
  it('提出済みでは選択も解除もできない（published）', () => {
    const p = makeProgress({
      opened: ['a', 'b', 'c'],
      pinned: ['a', 'b', 'c'],
      chosenLink: ['a'],
      published: true,
    });
    expect(canSelectForLink(c, p, 'b')).toEqual({ ok: false, reason: 'published' });
    expect(canSelectForLink(c, p, 'a')).toEqual({ ok: false, reason: 'published' });
    expect(toggleLinkSelection(c, p, 'b')).toBe(p);
    expect(toggleLinkSelection(c, p, 'a')).toBe(p);
  });
  it('採用済みで未提出なら選べる', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'] });
    expect(canSelectForLink(c, p, 'a')).toEqual({ ok: true });
  });
});

describe('link: 選択の切り替え', () => {
  it('2枚選ぶと照合が成立し、順序は問わない', () => {
    const p = makeProgress({ opened: ['a', 'c'], pinned: ['a', 'c'] });
    const q = toggleLinkSelection(c, toggleLinkSelection(c, p, 'c'), 'a');
    expect(q.chosenLink).toEqual(['c', 'a']);
    expect(isLinkComplete(q)).toBe(true);
    expect(isLinkCorrect(c, q)).toBe(true);
    expect(linkStatus(c, q)).toBe('correct');
  });
  it('同じ資料を2回押すと解除になり、自己照合にはならない', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'] });
    const once = toggleLinkSelection(c, p, 'a');
    expect(once.chosenLink).toEqual(['a']);
    const twice = toggleLinkSelection(c, once, 'a');
    expect(twice.chosenLink).toEqual([]);
    expect(isLinkComplete(twice)).toBe(false);
    expect(linkStatus(c, twice)).toBe('incomplete');
  });
  it('保存データ由来の重複選択も2枚として数えない（自己照合不可）', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'], chosenLink: ['a', 'a'] });
    expect(isLinkComplete(p)).toBe(false);
    expect(isLinkCorrect(c, p)).toBe(false);
    expect(linkStatus(c, p)).toBe('incomplete');
  });
  it('3枚目を押すと選び直しになる', () => {
    const p = makeProgress({
      opened: ['a', 'b', 'c'],
      pinned: ['a', 'b', 'c'],
      chosenLink: ['a', 'b'],
    });
    expect(toggleLinkSelection(c, p, 'c').chosenLink).toEqual(['c']);
  });
});

describe('link: 正誤判定', () => {
  it('1枚だけでは incomplete', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'], chosenLink: ['a'] });
    expect(linkStatus(c, p)).toBe('incomplete');
    expect(isLinkCorrect(c, p)).toBe(false);
  });
  it('誤った組み合わせは incorrect', () => {
    const p = makeProgress({ opened: ['a', 'b'], pinned: ['a', 'b'], chosenLink: ['a', 'b'] });
    expect(isLinkCorrect(c, p)).toBe(false);
    expect(linkStatus(c, p)).toBe('incorrect');
  });
  it('required_link が 2 要素でないケースは常に incorrect', () => {
    const p = makeProgress({ opened: ['a', 'c'], pinned: ['a', 'c'], chosenLink: ['a', 'c'] });
    expect(linkStatus(makeCase({ required_link: ['a'] }), p)).toBe('incorrect');
    expect(linkStatus(makeCase({ required_link: ['a', 'b', 'c'] }), p)).toBe('incorrect');
    expect(linkStatus(makeCase({ required_link: [] }), p)).toBe('incorrect');
  });
  it('required_link が同一要素のケースは常に incorrect（自己照合を正解にしない）', () => {
    const bad = makeCase({ required_link: ['a', 'a'] });
    const p = makeProgress({ opened: ['a', 'c'], pinned: ['a', 'c'], chosenLink: ['a', 'c'] });
    expect(linkStatus(bad, p)).toBe('incorrect');
    const self = makeProgress({ opened: ['a'], pinned: ['a'], chosenLink: ['a', 'a'] });
    expect(isLinkCorrect(bad, self)).toBe(false);
  });
});

describe('link: 実データ（data/cases）との整合', () => {
  it('5 件のケースが読み込まれている', () => {
    expect(CASES).toHaveLength(5);
  });

  /** 閲覧・採用・選択を reducer を通さず直接組み立てる */
  function progressWith(ids: string[]) {
    return makeProgress({ opened: ids, pinned: ids, chosenLink: ids });
  }

  it.each(CASES.map((cs) => [cs.id, cs] as const))(
    '%s: required_link の 2 枚はいずれも実在し、異なる資料である',
    (_id, cs) => {
      expect(cs.required_link).toHaveLength(2);
      expect(new Set(cs.required_link).size).toBe(2);
      for (const id of cs.required_link) {
        expect(cs.documents.some((d) => d.id === id)).toBe(true);
      }
    },
  );

  it.each(CASES.map((cs) => [cs.id, cs] as const))(
    '%s: required_link の 2 枚を採用して選ぶと correct（順不同）',
    (_id, cs) => {
      const [x, y] = cs.required_link;
      expect(linkStatus(cs, progressWith([x, y]))).toBe('correct');
      expect(linkStatus(cs, progressWith([y, x]))).toBe('correct');
    },
  );

  it.each(CASES.map((cs) => [cs.id, cs] as const))(
    '%s: toggle 操作で required_link の 2 枚を選ぶと correct',
    (_id, cs) => {
      const [x, y] = cs.required_link;
      let p = makeProgress({ opened: [x, y], pinned: [x, y] });
      p = toggleLinkSelection(cs, p, y);
      p = toggleLinkSelection(cs, p, x);
      expect(linkStatus(cs, p)).toBe('correct');
    },
  );

  it.each(CASES.map((cs) => [cs.id, cs] as const))(
    '%s: 片方を別資料に差し替えると incorrect',
    (_id, cs) => {
      const [x, y] = cs.required_link;
      const others = cs.documents.map((d) => d.id).filter((id) => id !== x && id !== y);
      expect(others.length).toBeGreaterThan(0);
      for (const other of others) {
        expect(linkStatus(cs, progressWith([x, other]))).toBe('incorrect');
        expect(linkStatus(cs, progressWith([other, y]))).toBe('incorrect');
      }
    },
  );

  it('cost 0 の初期資料が required_link に含まれるケース（case-02 / case-05）でも正解になる', () => {
    // required_link は required_evidence の部分集合とは限らない。
    const withFree = CASES.filter((cs) =>
      cs.required_link.some((id) => cs.documents.find((d) => d.id === id)?.cost === 0),
    );
    expect(withFree.map((cs) => cs.id)).toEqual(['case-02', 'case-05']);
    for (const cs of withFree) {
      expect(cs.required_link.every((id) => cs.required_evidence.includes(id))).toBe(false);
      expect(linkStatus(cs, progressWith([...cs.required_link]))).toBe('correct');
    }
  });
});
