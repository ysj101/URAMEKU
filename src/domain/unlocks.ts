import { ENCYCLOPEDIA, type EncyclopediaEntry } from '../data/encyclopedia';
import { countCorrectCalculations } from './calculation';
import { isLinkCorrect } from './link';
import type { CaseData, CaseProgress } from './types';

/**
 * 図鑑の解放条件と実績の判定（純粋関数。保存や UI には触れない）。
 *
 * 「合格」の定義: `finished[caseId] === true`。
 * `finished` は useGame が「提出済み AND publishVerdict が approved」のときだけ true にする。
 * 提出しただけ・部分点・未提出は `finished` に入らないので、ここでは `=== true` だけを見る。
 */

export type Finished = Record<string, boolean>;

/** `finished` で合格している事件 ID の集合（未知の ID はそのまま含むが、無害） */
function clearedCaseIds(finished: Finished | undefined | null): Set<string> {
  const ids = new Set<string>();
  if (!finished || typeof finished !== 'object') return ids;
  for (const [id, v] of Object.entries(finished)) if (v === true) ids.add(id);
  return ids;
}

/** 合格済みの事件に対応する図鑑項目だけを、図鑑の定義順で返す */
export function unlockedEntries(
  finished: Finished | undefined | null,
  entries: readonly EncyclopediaEntry[] = ENCYCLOPEDIA,
): EncyclopediaEntry[] {
  const cleared = clearedCaseIds(finished);
  return entries.filter((e) => cleared.has(e.unlockCase));
}

/** 図鑑項目が解放済みか */
export function isEntryUnlocked(entry: EncyclopediaEntry, finished: Finished): boolean {
  return finished[entry.unlockCase] === true;
}

export interface UnlockDelta {
  /** 今回新たに解放された図鑑項目 ID（定義順）。既に解放済みの項目は含まない */
  newlyUnlocked: string[];
}

/**
 * 前後の `finished` を比べ、新規に解放された図鑑項目だけを返す。
 * 既に解放済みの項目は二重に数えない（同じ事件を 2 回クリアしても delta は空）。
 * 解放が取り消されることはない（prev にあって next に無い項目は無視する）。
 */
export function unlockDelta(
  prevFinished: Finished | undefined | null,
  nextFinished: Finished | undefined | null,
  entries: readonly EncyclopediaEntry[] = ENCYCLOPEDIA,
): UnlockDelta {
  const before = new Set(unlockedEntries(prevFinished, entries).map((e) => e.id));
  const newlyUnlocked = unlockedEntries(nextFinished, entries)
    .map((e) => e.id)
    .filter((id) => !before.has(id));
  return { newlyUnlocked };
}

// ---------------------------------------------------------------------------
// 実績
// ---------------------------------------------------------------------------

/** data/achievements.json の 5 ルールの ID */
export const ACHIEVEMENT_IDS = [
  'first-evidence',
  'first-link',
  'number-check',
  'five-cases',
  'no-hint',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/** 「収録 5 件を解決する」の件数 */
export const FIVE_CASES_TARGET = 5;
/** 「数値検証 2 問を正しく回答する」の問数 */
export const NUMBER_CHECK_TARGET = 2;

/** 取得済み実績。値は取得時刻（ISO 8601） */
export type EarnedAchievements = Record<string, string>;

export interface AchievementState {
  /** 判定対象の事件定義（通常は CASES） */
  cases: readonly CaseData[];
  /** 事件 ID ごとの進行状態 */
  progress: Record<string, CaseProgress>;
  /** 合格済み事件 */
  finished: Finished;
  /** 既に取得済みの実績（維持される） */
  earned?: EarnedAchievements;
  /** 取得時刻（テストで固定するために注入可能） */
  now?: () => string;
}

export interface AchievementResult {
  /** 既得 + 今回新規取得。既得の時刻は変えない */
  earned: EarnedAchievements;
  /** 今回新たに取得した実績 ID（ACHIEVEMENT_IDS の順） */
  newlyEarned: AchievementId[];
}

function progressOf(state: AchievementState, caseId: string): CaseProgress | undefined {
  const p = state.progress[caseId];
  return p && typeof p === 'object' ? p : undefined;
}

/**
 * 各実績が「現在の状態で」成立しているか。
 *
 * 判定の定義（data/achievements.json の `rule` に対応）:
 * - first-evidence: いずれかの事件で証拠ボードに 1 件以上ピン留めしている
 * - first-link: いずれかの事件で照合が正解（`isLinkCorrect`）
 * - number-check: 全事件を通じて、許容誤差内の数値検証メモが合計 2 問以上
 * - five-cases: 実在する事件のうち合格（`finished === true`）が 5 件以上
 *   （`finished` 内の未知 ID は数えない）
 * - no-hint: 「ヒント無しでクリア」。MVP に「ヒント」機能は無いため、
 *   **合格済み（`finished === true`）かつ `revealed === false`** の事件が 1 件以上あること、
 *   と定義する。`revealed` は「解説と正解を公開した」フラグで、正解を見てから
 *   提出し直した場合に true になる。将来ヒント機能を追加したら、この定義を
 *   「ヒント使用回数 0」に置き換える。
 *
 * ここでは「現在の状態」しか見ない。既得の維持は `evaluateAchievements` が行う。
 */
export function achievementConditions(state: AchievementState): Record<AchievementId, boolean> {
  const knownIds = new Set(state.cases.map((c) => c.id));
  const cleared = [...clearedCaseIds(state.finished)].filter((id) => knownIds.has(id));

  let anyPinned = false;
  let anyLink = false;
  let correctCalcs = 0;
  for (const c of state.cases) {
    const p = progressOf(state, c.id);
    if (!p) continue;
    if (Array.isArray(p.pinned) && p.pinned.length > 0) anyPinned = true;
    if (isLinkCorrect(c, p)) anyLink = true;
    correctCalcs += countCorrectCalculations(c, p);
  }

  const noHint = cleared.some((id) => progressOf(state, id)?.revealed === false);

  return {
    'first-evidence': anyPinned,
    'first-link': anyLink,
    'number-check': correctCalcs >= NUMBER_CHECK_TARGET,
    'five-cases': cleared.length >= FIVE_CASES_TARGET,
    'no-hint': noHint,
  };
}

/**
 * 実績を判定し、既得と合わせた結果を返す。
 * - 一度取得した実績は失わない（条件が後で崩れても `earned` に残る）
 * - 既得の取得時刻は上書きしない（二重加算しない）
 * - `newlyEarned` は今回初めて成立した実績だけ
 */
export function evaluateAchievements(state: AchievementState): AchievementResult {
  const prev: EarnedAchievements = {};
  for (const [id, at] of Object.entries(state.earned ?? {})) {
    if (typeof at === 'string') prev[id] = at;
  }
  const conditions = achievementConditions(state);
  const now = state.now ?? (() => new Date().toISOString());
  const earned: EarnedAchievements = { ...prev };
  const newlyEarned: AchievementId[] = [];
  let stamp: string | undefined;
  for (const id of ACHIEVEMENT_IDS) {
    if (!conditions[id] || id in prev) continue;
    stamp ??= now();
    earned[id] = stamp;
    newlyEarned.push(id);
  }
  return { earned, newlyEarned };
}
