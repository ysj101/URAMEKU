import { LEGACY_KEYS, STORAGE_KEY, type SaveData, type StorageLike } from './persistence';

/**
 * 端末内保存の削除（MVP-031）。
 *
 * 対象は Web Storage（localStorage / sessionStorage）のうち、
 *  - 現行キー `STORAGE_KEY`
 *  - 読み取り専用の旧キー `LEGACY_KEYS`
 *  - 接頭辞 `urameku-` で始まるキー（将来の設定キーなど）
 * のすべて。
 *
 * IndexedDB / Cache Storage は MVP では使っていないため対象外。
 * PWA の Service Worker キャッシュは MVP-045 以降で扱う。
 */

/** アプリが新しく作るキーはすべてこの接頭辞で始める。 */
export const STORAGE_KEY_PREFIX = 'urameku-';

/** 列挙できる storage（`localStorage` / `sessionStorage` はこれを満たす）。 */
export interface EnumerableStorageLike extends StorageLike {
  readonly length: number;
  key(index: number): string | null;
}

function isEnumerable(storage: StorageLike): storage is EnumerableStorageLike {
  const s = storage as Partial<EnumerableStorageLike>;
  return typeof s.key === 'function' && typeof s.length === 'number';
}

function safeStorage(name: 'localStorage' | 'sessionStorage'): StorageLike | null {
  try {
    const s = globalThis[name];
    return s ?? null;
  } catch {
    return null;
  }
}

/** アプリのキーかどうか。 */
export function isAppKey(key: string): boolean {
  return key === STORAGE_KEY || LEGACY_KEYS.includes(key) || key.startsWith(STORAGE_KEY_PREFIX);
}

/**
 * storage に実在するアプリのキーを列挙する。
 * 列挙できない storage の場合は既知のキー（現行 + 旧）のうち値があるものだけ返す。
 */
export function listAppKeys(storage: StorageLike | null): string[] {
  if (!storage) return [];
  const found = new Set<string>();
  try {
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      if (storage.getItem(key) !== null) found.add(key);
    }
    if (isEnumerable(storage)) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null && isAppKey(key)) found.add(key);
      }
    }
  } catch {
    /* 読めない storage は空扱い */
  }
  return [...found].sort();
}

/** 1 つの storage からアプリのキーをすべて削除し、削除したキーを返す。 */
export function wipeStorage(storage: StorageLike | null): string[] {
  const keys = listAppKeys(storage);
  if (!storage) return [];
  const removed: string[] = [];
  for (const key of keys) {
    try {
      storage.removeItem(key);
      removed.push(key);
    } catch {
      /* 残存は verifyWiped が報告する */
    }
  }
  return removed;
}

/** 削除後に残っているアプリのキーを返す。空配列なら完全に消えている。 */
export function verifyWiped(storage: StorageLike | null): string[] {
  return listAppKeys(storage);
}

export interface WipeTargets {
  local?: StorageLike | null;
  session?: StorageLike | null;
}

export interface WipeResult {
  /** 削除したキー（storage 名付き） */
  removed: string[];
  /** 削除後も残っていたキー（storage 名付き）。空なら成功 */
  remaining: string[];
}

/**
 * localStorage と sessionStorage からアプリの保存をすべて削除する。
 * 既定では実際の Web Storage を使う。テストではスタブを渡す。
 */
export function wipeAllLocalData(targets?: WipeTargets): WipeResult {
  const local = targets && 'local' in targets ? targets.local : safeStorage('localStorage');
  const session = targets && 'session' in targets ? targets.session : safeStorage('sessionStorage');
  const removed: string[] = [];
  const remaining: string[] = [];
  for (const [name, storage] of [
    ['localStorage', local],
    ['sessionStorage', session],
  ] as const) {
    removed.push(...wipeStorage(storage ?? null).map((k) => `${name}:${k}`));
    remaining.push(...verifyWiped(storage ?? null).map((k) => `${name}:${k}`));
  }
  return { removed, remaining };
}

/**
 * 1 事件だけ初期化する（純粋関数）。
 * 他の事件の進行・クリア記録と `active` には触れない。
 */
export function resetCaseProgress(save: SaveData, caseId: string): SaveData {
  const progress = { ...save.progress };
  delete progress[caseId];
  const finished = { ...save.finished };
  delete finished[caseId];
  const legacyProgress = { ...save.legacyProgress };
  delete legacyProgress[caseId];
  const legacyFinished = { ...save.legacyFinished };
  delete legacyFinished[caseId];
  const archivedProgress = { ...save.archivedProgress };
  for (const key of Object.keys(archivedProgress))
    if (key.startsWith(`${caseId}@`)) delete archivedProgress[key];
  const caseRevisions = { ...save.caseRevisions };
  delete caseRevisions[caseId];
  return {
    ...save,
    progress,
    finished,
    ...(save.legacyProgress ? { legacyProgress } : {}),
    ...(save.legacyFinished ? { legacyFinished } : {}),
    ...(save.archivedProgress ? { archivedProgress } : {}),
    ...(save.caseRevisions ? { caseRevisions } : {}),
  };
}
