import { normalizeProgress } from '../domain/game';
import type { CaseProgress } from '../domain/types';

/**
 * セーブデータの移行（純粋関数。localStorage には触らない）。
 *
 * - v0: 試作 `prototype/app.js` がキー `paper-backside-mvp-v1` に保存していた形式。
 *       `{ active, progress, finished }`。`version` 無し。
 * - v1: MVP-003 の `urameku-mvp-v1` 形式。構造は v0 と同じで `version` 無し。
 *       v0 と v1 は中身だけでは区別できないため、読み出し元キーで判定する（`assumeVersion`）。
 * - v2: `version: 2` と `savedAt`（ISO 8601）を付けた形式。
 * - v3: MVP-030。途中状態 `session`（画面段階と最後に開いた資料）と、
 *       複数タブの競合判定に使う単調増加の `revision` を追加した現行形式。
 *
 * 将来の形式変更は `migrations` 配列に `{ from, to, up }` を 1 つ追加し、
 * `CURRENT_SAVE_VERSION` を上げるだけでよい。
 */
export const CURRENT_SAVE_VERSION = 3;

/** 画面の段階。`useGame` が公開する `Stage` と同じもの。 */
export type Stage = 'investigate' | 'article';

/** 事件途中の UI 状態。再起動後に同じ段階から再開するために保存する。 */
export interface SaveSession {
  stage: Stage;
  /** 選択中の事件で最後に開いた資料 ID。無ければ null */
  lastDocumentId: string | null;
}

/** アプリ内で扱う保存内容（`version` / `savedAt` は含まない）。 */
export interface SaveData {
  active: string;
  progress: Record<string, CaseProgress>;
  finished: Record<string, boolean>;
  session: SaveSession;
  /**
   * 保存のたびに 1 ずつ増える番号。複数タブで同じキーに書いたとき、どちらが新しいかの判定に使う
   * （`src/state/saveCoordinator.ts`）。時計のずれに影響されないよう `savedAt` より優先する。
   */
  revision: number;
}

/** 実際に storage へ書き込まれる現行形式。 */
export interface SaveDataV3 extends SaveData {
  version: 3;
  savedAt: string;
}

/** 互換用の別名。書き込み形式は常に最新（SaveDataV3）。 */
export type SaveDataV2 = SaveDataV3;

export function createSession(): SaveSession {
  return { stage: 'investigate', lastDocumentId: null };
}

export interface MigrationStep {
  from: number;
  to: number;
  /** 入力は from 形式として信頼せず、出力は to 形式として必ず整形して返す */
  up: (raw: Record<string, unknown>, ctx: MigrationContext) => Record<string, unknown>;
}

export interface MigrationContext {
  /** 移行時刻（ISO 8601）。テストで固定できるように注入する */
  now: () => string;
}

export interface MigrateOptions extends Partial<MigrationContext> {
  /**
   * `version` を持たないデータをどのバージョンとみなすか。
   * 旧キーから読んだ場合は 0、現行キーから読んだ場合は 1（既定）。
   */
  assumeVersion?: number;
}

export interface MigrateResult {
  data: SaveData;
  /** 移行元バージョン。既に最新形式なら null。未来バージョンはその数値 */
  migratedFrom: number | null;
  /** 解釈不能で初期化した場合 true */
  reset: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeProgressMap(raw: unknown): Record<string, CaseProgress> {
  const out: Record<string, CaseProgress> = {};
  if (!isRecord(raw)) return out;
  for (const [id, p] of Object.entries(raw)) out[id] = normalizeProgress(p);
  return out;
}

function normalizeFinished(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isRecord(raw)) return out;
  for (const [id, v] of Object.entries(raw)) if (v === true) out[id] = true;
  return out;
}

function normalizeSession(raw: unknown): SaveSession {
  const base = createSession();
  if (!isRecord(raw)) return base;
  const stage = raw.stage === 'article' ? 'article' : 'investigate';
  const last = raw.lastDocumentId;
  return {
    stage,
    lastDocumentId: typeof last === 'string' && last !== '' ? last : null,
  };
}

export function normalizeRevision(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

/** 読み取れるフィールドだけを拾って SaveData の形に整える。 */
export function normalizeSaveData(raw: Record<string, unknown>, fallbackCaseId: string): SaveData {
  return {
    active: typeof raw.active === 'string' && raw.active !== '' ? raw.active : fallbackCaseId,
    progress: normalizeProgressMap(raw.progress),
    finished: normalizeFinished(raw.finished),
    session: normalizeSession(raw.session),
    revision: normalizeRevision(raw.revision),
  };
}

/** 移行ステップ。from の昇順に並べ、隙間を作らないこと。 */
export const migrations: readonly MigrationStep[] = [
  {
    // 試作形式 → MVP-003 形式。構造は同じだが、試作は各フィールドの型を保証していないため整形する。
    from: 0,
    to: 1,
    up: (raw) => ({
      active: raw.active,
      progress: normalizeProgressMap(raw.progress),
      finished: normalizeFinished(raw.finished),
    }),
  },
  {
    // version と savedAt を付与する。元データに保存時刻は無いので移行時刻を入れる。
    from: 1,
    to: 2,
    up: (raw, ctx) => ({
      ...raw,
      version: 2,
      savedAt: ctx.now(),
    }),
  },
  {
    // 途中状態と revision を追加する。v2 には画面段階が無いので調査画面から再開させ、revision は 0 から始める。
    from: 2,
    to: 3,
    up: (raw) => ({
      ...raw,
      version: 3,
      session: createSession(),
      revision: 0,
    }),
  },
];

/** `version` を読む。無ければ assumeVersion。 */
export function detectVersion(raw: unknown, assumeVersion = 1): number | null {
  if (!isRecord(raw)) return null;
  if (!('version' in raw)) return assumeVersion;
  const v = raw.version;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

function resetResult(fallbackCaseId: string): MigrateResult {
  return {
    data: {
      active: fallbackCaseId,
      progress: {},
      finished: {},
      session: createSession(),
      revision: 0,
    },
    migratedFrom: null,
    reset: true,
  };
}

/**
 * 任意の生データを現行形式の SaveData に移行する。
 *
 * - 配列・プリミティブ・`version` が不正 → 初期化（`reset: true`）
 * - `version` が CURRENT_SAVE_VERSION より大きい（将来の形式、ロールバック時など）→
 *   初期化せず、読める共通フィールドだけを拾う。`migratedFrom` にその値を入れる。
 */
export function migrate(
  raw: unknown,
  fallbackCaseId: string,
  options: MigrateOptions = {},
): MigrateResult {
  const ctx: MigrationContext = { now: options.now ?? (() => new Date().toISOString()) };
  if (!isRecord(raw)) return resetResult(fallbackCaseId);
  const version = detectVersion(raw, options.assumeVersion ?? 1);
  if (version === null) return resetResult(fallbackCaseId);

  if (version > CURRENT_SAVE_VERSION) {
    return { data: normalizeSaveData(raw, fallbackCaseId), migratedFrom: version, reset: false };
  }

  let current = raw;
  let v = version;
  while (v < CURRENT_SAVE_VERSION) {
    const step = migrations.find((m) => m.from === v);
    if (!step) return resetResult(fallbackCaseId);
    current = step.up(current, ctx);
    v = step.to;
  }
  return {
    data: normalizeSaveData(current, fallbackCaseId),
    migratedFrom: version === CURRENT_SAVE_VERSION ? null : version,
    reset: false,
  };
}

/** 書き込み用に現行形式へ包む。 */
export function toSaveDataV3(
  data: SaveData,
  now: () => string = () => new Date().toISOString(),
): SaveDataV3 {
  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: now(),
    active: data.active,
    progress: data.progress,
    finished: data.finished,
    session: data.session,
    revision: data.revision,
  };
}

/** 互換用の別名。常に最新形式（v3）で包む。 */
export const toSaveDataV2 = toSaveDataV3;
