import { normalizeProgress } from '../domain/game';
import type { CaseProgress } from '../domain/types';

/**
 * セーブデータの移行（純粋関数。localStorage には触らない）。
 *
 * - v0: 試作 `prototype/app.js` がキー `paper-backside-mvp-v1` に保存していた形式。
 *       `{ active, progress, finished }`。`version` 無し。
 * - v1: MVP-003 の `urameku-mvp-v1` 形式。構造は v0 と同じで `version` 無し。
 *       v0 と v1 は中身だけでは区別できないため、読み出し元キーで判定する（`assumeVersion`）。
 * - v2: `version: 2` と `savedAt`（ISO 8601）を付けた現行形式。
 *
 * 将来の形式変更は `migrations` 配列に `{ from, to, up }` を 1 つ追加し、
 * `CURRENT_SAVE_VERSION` を上げるだけでよい。
 */
export const CURRENT_SAVE_VERSION = 2;

/** アプリ内で扱う保存内容（バージョン情報を含まない）。 */
export interface SaveData {
  active: string;
  progress: Record<string, CaseProgress>;
  finished: Record<string, boolean>;
}

/** 実際に storage へ書き込まれる現行形式。 */
export interface SaveDataV2 extends SaveData {
  version: 2;
  savedAt: string;
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

/** 読み取れるフィールドだけを拾って SaveData の形に整える。 */
export function normalizeSaveData(raw: Record<string, unknown>, fallbackCaseId: string): SaveData {
  return {
    active: typeof raw.active === 'string' && raw.active !== '' ? raw.active : fallbackCaseId,
    progress: normalizeProgressMap(raw.progress),
    finished: normalizeFinished(raw.finished),
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
    data: { active: fallbackCaseId, progress: {}, finished: {} },
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
export function toSaveDataV2(
  data: SaveData,
  now: () => string = () => new Date().toISOString(),
): SaveDataV2 {
  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: now(),
    active: data.active,
    progress: data.progress,
    finished: data.finished,
  };
}
