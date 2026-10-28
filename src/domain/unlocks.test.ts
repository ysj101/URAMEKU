import { CASES } from '../data/cases';
import { ENCYCLOPEDIA, type EncyclopediaEntry } from '../data/encyclopedia';
import { clearedProgress, makeCase, makeProgress } from '../test/fixtures';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';
import { createProgress, reduceProgress } from './game';
import { evaluateCase } from './scoring';
import type { CaseData, CaseProgress } from './types';
import {
  ACHIEVEMENT_IDS,
  achievementConditions,
  evaluateAchievements,
  isEntryUnlocked,
  unlockDelta,
  unlockedEntries,
  type AchievementState,
} from './unlocks';

const entries: EncyclopediaEntry[] = [
  { id: 'e1', title: 'a', summary: 's', unlockCase: 'case-01', art: 'a.png', disclaimer: 'd' },
  { id: 'e2', title: 'b', summary: 's', unlockCase: 'case-02', art: 'b.png', disclaimer: 'd' },
  { id: 'e3', title: 'c', summary: 's', unlockCase: 'case-03', art: 'c.png', disclaimer: 'd' },
];

describe('unlockedEntries', () => {
  it('合格（finished === true）の事件だけ解放する', () => {
    const r = unlockedEntries({ 'case-01': true, 'case-02': false }, entries);
    expect(r.map((e) => e.id)).toEqual(['e1']);
  });
  it('未提出・提出のみ・部分点は解放しない（finished に入っていない）', () => {
    expect(unlockedEntries({}, entries)).toEqual([]);
    expect(unlockedEntries({ 'case-01': false }, entries)).toEqual([]);
  });
  it('true 以外の truthy 値は合格とみなさない', () => {
    const bogus = { 'case-01': 1, 'case-02': 'true' } as unknown as Record<string, boolean>;
    expect(unlockedEntries(bogus, entries)).toEqual([]);
  });
  it('finished に未知のケース ID があっても壊れない', () => {
    const r = unlockedEntries({ 'case-99': true, 'case-02': true, '': true }, entries);
    expect(r.map((e) => e.id)).toEqual(['e2']);
  });
  it('finished が undefined / null / 非オブジェクトでも空配列', () => {
    expect(unlockedEntries(undefined, entries)).toEqual([]);
    expect(unlockedEntries(null, entries)).toEqual([]);
    expect(unlockedEntries('x' as unknown as Record<string, boolean>, entries)).toEqual([]);
  });
  it('図鑑の定義順を保つ', () => {
    const r = unlockedEntries({ 'case-03': true, 'case-01': true }, entries);
    expect(r.map((e) => e.id)).toEqual(['e1', 'e3']);
  });
  it('既定では実データの図鑑を使い、5 件合格で全項目が解放される', () => {
    const all = Object.fromEntries(CASES.map((c) => [c.id, true]));
    expect(unlockedEntries(all)).toHaveLength(ENCYCLOPEDIA.length);
    expect(unlockedEntries({ 'case-01': true }).map((e) => e.id)).toEqual(['framing']);
  });
  it('isEntryUnlocked', () => {
    expect(isEntryUnlocked(entries[0]!, { 'case-01': true })).toBe(true);
    expect(isEntryUnlocked(entries[0]!, { 'case-01': false })).toBe(false);
    expect(isEntryUnlocked(entries[0]!, {})).toBe(false);
  });
});

describe('unlockDelta', () => {
  it('新規解放だけを返す', () => {
    const r = unlockDelta({ 'case-01': true }, { 'case-01': true, 'case-02': true }, entries);
    expect(r.newlyUnlocked).toEqual(['e2']);
  });
  it('同じ事件を 2 回クリアしても delta は空（二重加算しない）', () => {
    const once = { 'case-01': true };
    expect(unlockDelta(once, { ...once }, entries).newlyUnlocked).toEqual([]);
    expect(unlockDelta(once, once, entries).newlyUnlocked).toEqual([]);
  });
  it('初回は prev が空でも動く', () => {
    expect(unlockDelta({}, { 'case-03': true }, entries).newlyUnlocked).toEqual(['e3']);
    expect(unlockDelta(undefined, { 'case-03': true }, entries).newlyUnlocked).toEqual(['e3']);
  });
  it('解放は取り消されない（prev にあって next に無くても何も返さない）', () => {
    expect(unlockDelta({ 'case-01': true }, {}, entries).newlyUnlocked).toEqual([]);
  });
  it('未知のケース ID や false は無視する', () => {
    const r = unlockDelta({}, { 'case-99': true, 'case-01': false, 'case-02': true }, entries);
    expect(r.newlyUnlocked).toEqual(['e2']);
  });
  it('旧形式の useGame と同じ流れ: 合格した瞬間に 1 回だけ解放され、以降は空', () => {
    const c = makeCase({ id: 'case-01' });
    let p = createProgress();
    let finished: Record<string, boolean> = {};
    const step = (next: CaseProgress) => {
      const prev = finished;
      finished = { ...finished };
      if (next.published && evaluateCase(c, next).cleared) finished[c.id] = true;
      p = next;
      return unlockDelta(prev, finished).newlyUnlocked;
    };
    for (const id of new Set([...c.required_evidence, ...c.required_link])) {
      expect(step(reduceProgress(c, p, { type: 'open-document', documentId: id }))).toEqual([]);
    }
    for (const id of c.required_link) {
      expect(step(reduceProgress(c, p, { type: 'toggle-link', documentId: id }))).toEqual([]);
    }
    for (const t of c.analysis_tasks) {
      const value = String(t.expected);
      expect(step(reduceProgress(c, p, { type: 'set-calculation', taskId: t.id, value }))).toEqual(
        [],
      );
    }
    for (const f of c.correct_fragments) {
      expect(step(reduceProgress(c, p, { type: 'add-fragment', fragmentId: f }))).toEqual([]);
    }
    // 提出前は部分点が揃っていても解放しない
    expect(unlockedEntries(finished)).toEqual([]);
    expect(step(reduceProgress(c, p, { type: 'submit' }))).toEqual(['framing']);
    // 取り下げて再提出しても二重加算しない
    expect(step(reduceProgress(c, p, { type: 'withdraw' }))).toEqual([]);
    expect(step(reduceProgress(c, p, { type: 'submit' }))).toEqual([]);
    expect(step(reduceProgress(c, p, { type: 'reveal' }))).toEqual([]);
  });
});

describe('evaluateAchievements', () => {
  const now = () => '2026-10-24T00:00:00.000Z';
  const cases: CaseData[] = Array.from({ length: 5 }, (_, i) => makeCase({ id: `case-0${i + 1}` }));
  function state(over: Partial<AchievementState> = {}): AchievementState {
    return { cases, progress: {}, finished: {}, now, ...over };
  }

  it('初期状態では何も成立しない', () => {
    const r = evaluateAchievements(state());
    expect(r.earned).toEqual({});
    expect(r.newlyEarned).toEqual([]);
    for (const id of ACHIEVEMENT_IDS) expect(achievementConditions(state())[id]).toBe(false);
  });

  describe('first-evidence（最初の資料を読む）', () => {
    it('資料を 1 件開いて読むと成立する', () => {
      const opened = state({ progress: { 'case-01': makeProgress({ opened: ['a'] }) } });
      expect(achievementConditions(opened)['first-evidence']).toBe(true);
      expect(evaluateAchievements(opened).newlyEarned).toEqual(['first-evidence']);
    });
  });

  describe('first-link（2 件を正しく照合）', () => {
    it('required_link と一致したときだけ成立', () => {
      const wrong = state({
        progress: { 'case-01': makeProgress({ opened: ['a', 'b'], chosenLink: ['a', 'b'] }) },
      });
      expect(achievementConditions(wrong)['first-link']).toBe(false);
      const one = state({
        progress: { 'case-01': makeProgress({ opened: ['a', 'c'], chosenLink: ['a'] }) },
      });
      expect(achievementConditions(one)['first-link']).toBe(false);
      const right = state({
        progress: { 'case-01': makeProgress({ opened: ['a', 'c'], chosenLink: ['c', 'a'] }) },
      });
      expect(achievementConditions(right)['first-link']).toBe(true);
    });
  });

  describe('number-check（数値 2 問正解）', () => {
    it('1 問では不成立、2 問で成立（事件をまたいで合算）', () => {
      const one = state({ progress: { 'case-01': makeProgress({ calculations: { t1: '45' } }) } });
      expect(achievementConditions(one)['number-check']).toBe(false);
      const two = state({
        progress: { 'case-01': makeProgress({ calculations: { t1: '45', t2: '200' } }) },
      });
      expect(achievementConditions(two)['number-check']).toBe(true);
      const across = state({
        progress: {
          'case-01': makeProgress({ calculations: { t1: '45', t2: 'x' } }),
          'case-02': makeProgress({ calculations: { t2: '200' } }),
        },
      });
      expect(achievementConditions(across)['number-check']).toBe(true);
    });
    it('不正解の回答は数えない', () => {
      const s = state({
        progress: { 'case-01': makeProgress({ calculations: { t1: '46', t2: '201' } }) },
      });
      expect(achievementConditions(s)['number-check']).toBe(false);
    });
  });

  describe('five-cases（5 件解決）', () => {
    it('4 件では不成立、5 件で成立', () => {
      const four = state({
        finished: { 'case-01': true, 'case-02': true, 'case-03': true, 'case-04': true },
      });
      expect(achievementConditions(four)['five-cases']).toBe(false);
      const five = state({ finished: { ...four.finished, 'case-05': true } });
      expect(achievementConditions(five)['five-cases']).toBe(true);
      expect(evaluateAchievements(five).newlyEarned).toEqual(['five-cases']);
    });
    it('false や未知のケース ID は数えない', () => {
      const s = state({
        finished: {
          'case-01': true,
          'case-02': true,
          'case-03': true,
          'case-04': true,
          'case-05': false,
          'case-99': true,
          ghost: true,
        },
      });
      expect(achievementConditions(s)['five-cases']).toBe(false);
    });
    it('実データ 5 件をクリアすると five-cases', () => {
      const finished = Object.fromEntries(CASES.map((c) => [c.id, true]));
      const r = evaluateAchievements({ cases: CASES, progress: {}, finished, now });
      expect(r.earned['five-cases']).toBe(now());
    });
  });

  describe('no-hint（クリア時点で revealed === false）', () => {
    it('合格かつ未公開なら成立', () => {
      const s = state({
        progress: { 'case-01': clearedProgress() },
        finished: { 'case-01': true },
      });
      expect(achievementConditions(s)['no-hint']).toBe(true);
    });
    it('正解を公開してから合格した場合は不成立', () => {
      const s = state({
        progress: { 'case-01': makeProgress({ ...clearedProgress(), revealed: true }) },
        finished: { 'case-01': true },
      });
      expect(achievementConditions(s)['no-hint']).toBe(false);
    });
    it('未公開でも合格していなければ不成立', () => {
      const s = state({
        progress: { 'case-01': clearedProgress() },
        finished: { 'case-01': false },
      });
      expect(achievementConditions(s)['no-hint']).toBe(false);
      const noProgress = state({ finished: { 'case-01': true } });
      expect(achievementConditions(noProgress)['no-hint']).toBe(false);
    });
  });

  describe('既得の維持', () => {
    it('条件が崩れても earned から消えず、取得時刻も変わらない', () => {
      const first = evaluateAchievements(
        state({ progress: { 'case-01': makeProgress({ opened: ['a'] }) } }),
      );
      expect(first.earned).toEqual({ 'first-evidence': now() });
      const later = evaluateAchievements(
        state({
          progress: { 'case-01': makeProgress() },
          earned: first.earned,
          now: () => '2027-01-01T00:00:00.000Z',
        }),
      );
      expect(later.earned).toEqual({ 'first-evidence': now() });
      expect(later.newlyEarned).toEqual([]);
    });
    it('既得は newlyEarned に再度含めない（二重加算しない）', () => {
      const s = state({ progress: { 'case-01': makeProgress({ opened: ['a'] }) } });
      const first = evaluateAchievements(s);
      const second = evaluateAchievements({ ...s, earned: first.earned });
      expect(second.newlyEarned).toEqual([]);
      expect(second.earned).toEqual(first.earned);
    });
    it('入力の earned を変更しない', () => {
      const earned = { 'first-evidence': '2020-01-01T00:00:00.000Z' };
      const s = state({
        progress: { 'case-01': makeProgress({ opened: ['a', 'c'], chosenLink: ['a', 'c'] }) },
        earned,
      });
      const r = evaluateAchievements(s);
      expect(earned).toEqual({ 'first-evidence': '2020-01-01T00:00:00.000Z' });
      expect(r.newlyEarned).toEqual(['first-link']);
      expect(r.earned['first-link']).toBe(now());
    });
    it('未知の実績 ID や壊れた値があっても落ちない', () => {
      const earned = { legacy: '2020-01-01T00:00:00.000Z', broken: 1 } as unknown as Record<
        string,
        string
      >;
      const r = evaluateAchievements(state({ earned }));
      expect(r.earned).toEqual({ legacy: '2020-01-01T00:00:00.000Z' });
    });
  });

  it('全部まとめてクリアすると 5 実績すべて取得', () => {
    const progress = Object.fromEntries(cases.map((c) => [c.id, clearedProgress()]));
    const finished = Object.fromEntries(cases.map((c) => [c.id, true]));
    const r = evaluateAchievements(state({ progress, finished }));
    expect(r.newlyEarned).toEqual([...ACHIEVEMENT_IDS]);
    expect(Object.keys(r.earned).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
  });

  it('now を省略すると ISO 8601 の現在時刻', () => {
    const r = evaluateAchievements({
      cases,
      progress: { 'case-01': makeProgress({ opened: ['a'] }) },
      finished: {},
    });
    expect(() => new Date(r.earned['first-evidence']!).toISOString()).not.toThrow();
  });
});

it('V2は根拠付き完了後の提出でのみ図鑑を一度解放し、計算実績を要求しない', () => {
  const c = makeV2Case({ id: 'case-01' });
  let p = makeV2Progress();
  p.v2!.decoding.scope = { optionId: 'open', evidence: ['a', 'b'] };
  p.v2!.links = [{ from: 'a', to: 'b', relation: 'qualifies' }];
  p.v2!.report = { claim: '対象範囲内に限られる', uncertainty: '範囲外は未確認' };
  expect(evaluateCase(c, p).cleared).toBe(true);
  expect(unlockedEntries({})).toEqual([]);
  p = reduceProgress(c, p, { type: 'submit' });
  const finished = p.published && evaluateCase(c, p).cleared ? { [c.id]: true } : {};
  expect(unlockDelta({}, finished).newlyUnlocked).toEqual(['framing']);
  expect(unlockDelta(finished, finished).newlyUnlocked).toEqual([]);
  const conditions = achievementConditions({ cases: [c], progress: { [c.id]: p }, finished });
  expect(conditions['first-link']).toBe(true);
  expect(conditions['number-check']).toBe(false);
});
