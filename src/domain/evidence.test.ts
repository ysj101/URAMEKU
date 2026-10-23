import {
  canPinDocument,
  canUnpinDocument,
  pinDocument,
  togglePin,
  unpinDocument,
} from './evidence';
import { reduceProgress } from './game';
import { makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();

describe('evidence: canPinDocument', () => {
  it('未閲覧の資料は not-opened', () => {
    expect(canPinDocument(c, makeProgress(), 'a')).toEqual({ ok: false, reason: 'not-opened' });
  });
  it('閲覧済みなら ok', () => {
    expect(canPinDocument(c, makeProgress({ opened: ['a'] }), 'a')).toEqual({ ok: true });
  });
  it('採用済みは already-pinned', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'] });
    expect(canPinDocument(c, p, 'a')).toEqual({ ok: false, reason: 'already-pinned' });
  });
  it('存在しない ID は unknown-document（閲覧済みに紛れ込んでいても）', () => {
    const p = makeProgress({ opened: ['zzz'] });
    expect(canPinDocument(c, p, 'zzz')).toEqual({ ok: false, reason: 'unknown-document' });
  });
  it('提出済みは published（閲覧済みでも採用不可）', () => {
    const p = makeProgress({ opened: ['a'], published: true });
    expect(canPinDocument(c, p, 'a')).toEqual({ ok: false, reason: 'published' });
  });
  it('unknown-document は published より優先して報告する', () => {
    const p = makeProgress({ opened: ['zzz'], published: true });
    expect(canPinDocument(c, p, 'zzz').reason).toBe('unknown-document');
  });
});

describe('evidence: canUnpinDocument', () => {
  it('採用していない資料は not-pinned', () => {
    const p = makeProgress({ opened: ['a'] });
    expect(canUnpinDocument(c, p, 'a')).toEqual({ ok: false, reason: 'not-pinned' });
  });
  it('採用済みなら ok', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'] });
    expect(canUnpinDocument(c, p, 'a')).toEqual({ ok: true });
  });
  it('提出済みは published', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'], published: true });
    expect(canUnpinDocument(c, p, 'a')).toEqual({ ok: false, reason: 'published' });
  });
  it('存在しない ID は unknown-document', () => {
    expect(canUnpinDocument(c, makeProgress(), 'zzz')).toEqual({
      ok: false,
      reason: 'unknown-document',
    });
  });
});

describe('evidence: pinDocument', () => {
  it('未閲覧の資料は採用できず、同じ参照を返す', () => {
    const p = makeProgress();
    expect(pinDocument(p, 'a')).toBe(p);
    expect(pinDocument(c, p, 'a')).toBe(p);
  });
  it('閲覧済みの資料は採用でき、重複しない', () => {
    const p = makeProgress({ opened: ['a'] });
    const once = pinDocument(p, 'a');
    expect(once.pinned).toEqual(['a']);
    expect(pinDocument(once, 'a')).toBe(once);
    expect(pinDocument(c, once, 'a')).toBe(once);
  });
  it('元の progress を変更しない（イミュータブル）', () => {
    const p = makeProgress({ opened: ['a'] });
    pinDocument(p, 'a');
    expect(p.pinned).toEqual([]);
  });
  it('提出済みの状態ではボードを変更できない', () => {
    const p = makeProgress({ opened: ['a'], published: true });
    expect(pinDocument(p, 'a')).toBe(p);
    expect(pinDocument(c, p, 'a')).toBe(p);
  });
  it('caseData 付きの版は存在しない ID を拒否する（互換版は opened を信用する）', () => {
    const p = makeProgress({ opened: ['zzz'] });
    expect(pinDocument(c, p, 'zzz')).toBe(p);
    expect(pinDocument(p, 'zzz').pinned).toEqual(['zzz']);
  });
  it('複数資料は採用した順に末尾へ追加される', () => {
    let p = makeProgress({ opened: ['a', 'b', 'c'] });
    p = pinDocument(c, p, 'c');
    p = pinDocument(c, p, 'a');
    p = pinDocument(c, p, 'b');
    expect(p.pinned).toEqual(['c', 'a', 'b']);
  });
});

describe('evidence: unpinDocument', () => {
  it('取り下げると照合選択からも外れる', () => {
    const p = makeProgress({ opened: ['a', 'b'], pinned: ['a', 'b'], chosenLink: ['a', 'b'] });
    const q = unpinDocument(p, 'a');
    expect(q.pinned).toEqual(['b']);
    expect(q.chosenLink).toEqual(['b']);
    expect(unpinDocument(c, p, 'a')).toEqual(q);
  });
  it('採用していない資料の取り下げは何もしない', () => {
    const p = makeProgress({ opened: ['a'] });
    expect(unpinDocument(p, 'a')).toBe(p);
    expect(unpinDocument(c, p, 'a')).toBe(p);
  });
  it('提出済みの状態では取り下げられない', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'], chosenLink: ['a'], published: true });
    expect(unpinDocument(p, 'a')).toBe(p);
    expect(unpinDocument(c, p, 'a')).toBe(p);
  });
  it('存在しない ID は caseData 付きの版で拒否される', () => {
    const p = makeProgress({ opened: ['zzz'], pinned: ['zzz'] });
    expect(unpinDocument(c, p, 'zzz')).toBe(p);
  });
  it('取り下げても閲覧履歴（opened）は残る', () => {
    const p = makeProgress({ opened: ['a'], pinned: ['a'] });
    expect(unpinDocument(c, p, 'a').opened).toEqual(['a']);
  });
});

describe('evidence: 再採用', () => {
  it('取り下げ後に再採用すると末尾に追加され、重複しない', () => {
    let p = makeProgress({ opened: ['a', 'b', 'c'], pinned: ['a', 'b', 'c'] });
    p = unpinDocument(c, p, 'a');
    expect(p.pinned).toEqual(['b', 'c']);
    p = pinDocument(c, p, 'a');
    expect(p.pinned).toEqual(['b', 'c', 'a']);
    p = pinDocument(c, p, 'a');
    expect(p.pinned).toEqual(['b', 'c', 'a']);
  });
  it('unpin 後に再 pin しても chosenLink は復元されない（明示仕様）', () => {
    let p = makeProgress({ opened: ['a', 'c'], pinned: ['a', 'c'], chosenLink: ['a', 'c'] });
    p = unpinDocument(c, p, 'a');
    expect(p.chosenLink).toEqual(['c']);
    p = pinDocument(c, p, 'a');
    expect(p.pinned).toEqual(['c', 'a']);
    expect(p.chosenLink).toEqual(['c']);
  });
});

describe('evidence: togglePin', () => {
  it('toggle は採用と取り下げを切り替える（往復で元に戻る）', () => {
    const p = makeProgress({ opened: ['a'] });
    const on = togglePin(p, 'a');
    expect(on.pinned).toEqual(['a']);
    const off = togglePin(on, 'a');
    expect(off.pinned).toEqual([]);
    expect(off).toEqual(p);
    expect(togglePin(c, togglePin(c, p, 'a'), 'a')).toEqual(p);
  });
  it('未閲覧の toggle は何もしない', () => {
    const p = makeProgress();
    expect(togglePin(p, 'a')).toBe(p);
    expect(togglePin(c, p, 'a')).toBe(p);
  });
  it('提出済みの toggle は採用側も取り下げ側も何もしない', () => {
    const pinned = makeProgress({ opened: ['a', 'b'], pinned: ['a'], published: true });
    expect(togglePin(c, pinned, 'a')).toBe(pinned);
    expect(togglePin(c, pinned, 'b')).toBe(pinned);
  });
  it('存在しない ID の toggle は caseData 付きの版で何もしない', () => {
    const p = makeProgress({ opened: ['zzz'] });
    expect(togglePin(c, p, 'zzz')).toBe(p);
  });
});

describe('evidence: reducer 経由の状態遷移（未読 → 閲覧済み → 採用 → 取り下げ）', () => {
  it('open しないと pin できず、open 後は pin / unpin / 再 pin が通る', () => {
    let p = makeProgress();
    p = reduceProgress(c, p, { type: 'toggle-pin', documentId: 'a' });
    expect(p.pinned).toEqual([]);
    p = reduceProgress(c, p, { type: 'open-document', documentId: 'a' });
    p = reduceProgress(c, p, { type: 'toggle-pin', documentId: 'a' });
    expect(p.pinned).toEqual(['a']);
    p = reduceProgress(c, p, { type: 'toggle-pin', documentId: 'a' });
    expect(p.pinned).toEqual([]);
    p = reduceProgress(c, p, { type: 'toggle-pin', documentId: 'a' });
    expect(p.pinned).toEqual(['a']);
  });
  it('reducer は存在しない資料 ID を拒否する', () => {
    const p = makeProgress({ opened: ['zzz'] });
    expect(reduceProgress(c, p, { type: 'toggle-pin', documentId: 'zzz' })).toBe(p);
  });
  it('提出済みでは変更できず、withdraw 後なら変更できる', () => {
    const base = makeProgress({
      opened: ['a', 'b', 'c'],
      pinned: ['a', 'b', 'c'],
      chosenLink: ['a', 'c'],
      article: ['f0', 'f1', 'f2'],
    });
    const published = reduceProgress(c, base, { type: 'submit' });
    expect(published.published).toBe(true);
    expect(reduceProgress(c, published, { type: 'toggle-pin', documentId: 'a' })).toBe(published);
    const editing = reduceProgress(c, published, { type: 'withdraw' });
    const after = reduceProgress(c, editing, { type: 'toggle-pin', documentId: 'a' });
    expect(after.pinned).toEqual(['b', 'c']);
    expect(after.chosenLink).toEqual(['c']);
  });
});
