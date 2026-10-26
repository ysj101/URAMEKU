import {
  createSession,
  migrate,
  detectVersion,
  CURRENT_SAVE_VERSION,
  toSaveDataV3,
  type MigrateResult,
  type SaveData,
} from './migrations';
import { wipeStorage } from './wipe';

export type {
  SaveData,
  SaveDataV2,
  SaveDataV3,
  SaveDataV4,
  SaveSession,
  Stage,
  MigrateResult,
} from './migrations';
export { CURRENT_SAVE_VERSION } from './migrations';

/**
 * 端末内保存。形式のバージョン付けと移行は migrations.ts、
 * 複数タブ間の競合判定は saveCoordinator.ts（購読は useGame.ts）で扱う。
 *
 * キー名は MVP-003 から変えていない（中身の version で判別するため）。
 * 旧キーは読み取り専用で、削除は MVP-031 の責務。
 */
export const STORAGE_KEY = 'urameku-mvp-v1';
/** 読み取りだけ行う旧キー。先頭から順に探す。 */
export const LEGACY_KEYS: readonly string[] = ['paper-backside-mvp-v1'];

export function createSaveData(activeCaseId: string): SaveData {
  return {
    active: activeCaseId,
    progress: {},
    finished: {},
    session: createSession(),
    revision: 0,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 既定の保存先。localStorage が無い・アクセスで例外が出る環境（プライベートモード等）では null。 */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function safeParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * 読み込みの詳細版。どのキーから読み、どのバージョンから移行したかを返す。
 * 現行キーに何も無いときだけ旧キーを順に見る。現行キーが壊れている場合は旧キーに戻らず初期化する。
 */
export function loadSaveDataDetailed(
  fallbackCaseId: string,
  storage: StorageLike | null = defaultStorage(),
): MigrateResult & { sourceKey: string | null; savedAt: string | null } {
  const empty = {
    data: createSaveData(fallbackCaseId),
    migratedFrom: null,
    reset: false,
    savedAt: null,
  };
  if (!storage) return { ...empty, sourceKey: null };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = safeParse(raw);
      const result = parsed.ok
        ? migrate(parsed.value, fallbackCaseId, { assumeVersion: 1 })
        : migrate(undefined, fallbackCaseId);
      return { ...result, sourceKey: STORAGE_KEY, savedAt: readSavedAt(parsed) };
    }
    for (const key of LEGACY_KEYS) {
      const legacy = storage.getItem(key);
      if (!legacy) continue;
      const parsed = safeParse(legacy);
      const result = parsed.ok
        ? migrate(parsed.value, fallbackCaseId, { assumeVersion: 0 })
        : migrate(undefined, fallbackCaseId);
      return { ...result, sourceKey: key, savedAt: null };
    }
    return { ...empty, sourceKey: null };
  } catch {
    return { ...empty, reset: true, sourceKey: null };
  }
}

/** 生データの `savedAt`（文字列のときだけ）。 */
function readSavedAt(parsed: { ok: true; value: unknown } | { ok: false }): string | null {
  if (!parsed.ok) return null;
  const v = parsed.value;
  if (typeof v !== 'object' || v === null) return null;
  const savedAt = (v as { savedAt?: unknown }).savedAt;
  return typeof savedAt === 'string' ? savedAt : null;
}

export function loadSaveData(
  fallbackCaseId: string,
  storage: StorageLike | null = defaultStorage(),
): SaveData {
  return loadSaveDataDetailed(fallbackCaseId, storage).data;
}

/**
 * `storage` イベントの `newValue` など、現行キーの生の文字列を SaveData に解釈する。
 * 読めなければ null（初期化はしない。他タブの壊れた保存で自タブを消さないため）。
 */
export function parseStoredSaveData(
  raw: string | null,
  fallbackCaseId: string,
): (SaveData & { savedAt: string | null }) | null {
  if (!raw) return null;
  const parsed = safeParse(raw);
  if (!parsed.ok) return null;
  const result = migrate(parsed.value, fallbackCaseId, { assumeVersion: 1 });
  if (result.reset) return null;
  return { ...result.data, savedAt: readSavedAt(parsed) };
}

/**
 * 常に最新形式（version / savedAt 付き）で保存する。容量超過などで失敗したら false。
 * `now` は保存時刻（テストや競合判定のために注入できる）。
 */
export function persistSaveData(
  data: SaveData,
  storage: StorageLike | null = defaultStorage(),
  now: () => string = () => new Date().toISOString(),
): boolean {
  if (!storage || data.readOnlyVersion) return false;
  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing) {
      const parsed = safeParse(existing);
      const version = parsed.ok ? detectVersion(parsed.value) : null;
      if (version !== null && version > CURRENT_SAVE_VERSION) return false;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(toSaveDataV3(data, now)));
    return true;
  } catch {
    return false;
  }
}

/** 端末内保存の削除。実体は wipe.ts（現行キー・旧キー・`urameku-` 接頭辞キーをすべて消す）。 */
export function clearSaveData(storage: StorageLike | null = defaultStorage()): void {
  wipeStorage(storage);
}
