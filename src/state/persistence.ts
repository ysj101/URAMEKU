import { normalizeProgress } from '../domain/game';
import type { CaseProgress } from '../domain/types';

/**
 * 端末内保存。バージョン付けと移行は MVP-029、競合処理は MVP-030 で扱う。
 */
export const STORAGE_KEY = 'urameku-mvp-v1';

export interface SaveData {
  active: string;
  progress: Record<string, CaseProgress>;
  finished: Record<string, boolean>;
}

export function createSaveData(activeCaseId: string): SaveData {
  return { active: activeCaseId, progress: {}, finished: {} };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSaveData(
  fallbackCaseId: string,
  storage: StorageLike | null = defaultStorage(),
): SaveData {
  const base = createSaveData(fallbackCaseId);
  if (!storage) return base;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const progress: Record<string, CaseProgress> = {};
    if (parsed.progress && typeof parsed.progress === 'object') {
      for (const [id, p] of Object.entries(parsed.progress)) progress[id] = normalizeProgress(p);
    }
    const finished: Record<string, boolean> = {};
    if (parsed.finished && typeof parsed.finished === 'object') {
      for (const [id, v] of Object.entries(parsed.finished)) finished[id] = v === true;
    }
    return {
      active: typeof parsed.active === 'string' ? parsed.active : fallbackCaseId,
      progress,
      finished,
    };
  } catch {
    return base;
  }
}

export function persistSaveData(
  data: SaveData,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSaveData(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
