import { resetCaseProgress } from './wipe';
import { restoreProgress } from './restoreProgress';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CASES, findCase, nextCaseId } from '../data/cases';
import { createProgress, reduceProgress, type GameAction } from '../domain/game';
import { evaluateCase } from '../domain/scoring';
import type { CaseData, CaseProgress } from '../domain/types';
import { createSession, type Stage } from './migrations';
import {
  clearSaveData,
  createSaveData,
  defaultStorage,
  loadSaveDataDetailed,
  parseStoredSaveData,
  persistSaveData,
  STORAGE_KEY,
  type SaveData,
  type StorageLike,
} from './persistence';
import { nextRevision, resolveConflict } from './saveCoordinator';

export type { Stage };

/**
 * 直近の保存結果。
 * - saved: 最後の書き込みが成功（または書くものが無い）
 * - failed: 書き込みが失敗した（容量超過など）。進行は画面上では続くが端末には残らない
 * - unavailable: この環境では保存先（localStorage）が使えない
 */
export type SaveStatus = 'saved' | 'failed' | 'unavailable' | 'read-only';

export interface GameApi {
  migrationNotice?: string;
  legacyFinished?: Record<string, boolean>;
  cases: CaseData[];
  current: CaseData;
  progress: CaseProgress;
  stage: Stage;
  finished: Record<string, boolean>;
  /** 事件 ID ごとの進行（一覧表示用。未着手の事件は含まれない） */
  progressByCase?: Record<string, CaseProgress>;
  dispatch: (action: GameAction) => void;
  selectCase: (id: string) => void;
  setStage: (stage: Stage) => void;
  goToNextCase: () => void;
  resetAll: () => void;
  /**
   * 以下は MVP-030 で追加。`useGame` は常に返すが、既存の画面テストが `GameApi` のスタブを
   * 手書きしているため optional にしてある（表示は MVP-028 が担当）。
   */
  saveStatus?: SaveStatus;
  /** 選択中の事件で最後に開いた資料 ID。`open-document` の成功時に自動で記録される */
  lastDocumentId?: string | null;
  setLastDocument?: (documentId: string | null) => void;
}

export interface UseGameOptions {
  /** 保存先。省略時は localStorage。null なら保存しない（saveStatus: 'unavailable'） */
  storage?: StorageLike | null;
  /** 連続入力をまとめる待ち時間（ms） */
  debounceMs?: number;
}

export const SAVE_DEBOUNCE_MS = 150;

const FIRST_CASE = CASES[0]?.id ?? 'case-01';

/** 読み込んだ保存内容を、存在する事件・資料に合わせて整える（revision は保つ）。 */
export function sanitize(loaded: SaveData): SaveData {
  const progress = { ...loaded.progress };
  const finished = { ...loaded.finished };
  const archivedProgress = { ...loaded.archivedProgress };
  let migrationNotice = loaded.migrationNotice;
  for (const c of CASES) {
    if (!c.v2) continue;
    if (progress[c.id] && (!progress[c.id]?.v2 || loaded.caseRevisions?.[c.id] !== c.v2.revision)) {
      archivedProgress[`${c.id}@${loaded.caseRevisions?.[c.id] ?? 'legacy'}`] = progress[c.id]!;
      delete progress[c.id];
      delete finished[c.id];
      migrationNotice =
        '事件の形式が変わったため、対応できない途中状態を履歴に保管して調査を再開します。';
    }
    if (loaded.caseRevisions?.[c.id] !== c.v2.revision) delete finished[c.id];
    if (progress[c.id]) progress[c.id] = restoreProgress(c, progress[c.id]!);
  }
  loaded = {
    ...loaded,
    progress,
    finished,
    ...(Object.keys(archivedProgress).length ? { archivedProgress } : {}),
    ...(migrationNotice ? { migrationNotice } : {}),
  };
  const caseData = findCase(loaded.active);
  if (!caseData) return { ...loaded, active: FIRST_CASE, session: createSession() };
  const last = loaded.session.lastDocumentId;
  if (last !== null && !caseData.documents.some((d) => d.id === last)) {
    return { ...loaded, session: { ...loaded.session, lastDocumentId: null } };
  }
  return loaded;
}

export function useGame(options: UseGameOptions = {}): GameApi {
  const [storage] = useState<StorageLike | null>(() =>
    options.storage === undefined ? defaultStorage() : options.storage,
  );
  const debounceMs = options.debounceMs ?? SAVE_DEBOUNCE_MS;

  const [initial] = useState(() => loadSaveDataDetailed(FIRST_CASE, storage));
  const [save, setSave] = useState<SaveData>(() => sanitize(initial.data));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initial.data.readOnlyVersion ? 'read-only' : storage ? 'saved' : 'unavailable',
  );

  /** 最後に書き込んだ（または storage から取り込んだ）revision と時刻。これと同じなら書かない */
  const persistedRef = useRef<{ revision: number; savedAt: string | null }>({
    revision: initial.data.revision,
    savedAt: initial.savedAt,
  });
  const latestRef = useRef<SaveData>(save);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** 未保存の変更があれば即時に書き込む。 */
  const flush = useCallback(() => {
    cancelTimer();
    const data = latestRef.current;
    if (data.readOnlyVersion) {
      setSaveStatus('read-only');
      return;
    }
    if (data.revision === persistedRef.current.revision) return;
    if (!storage) {
      setSaveStatus('unavailable');
      return;
    }
    const savedAt = new Date().toISOString();
    const ok = persistSaveData(data, storage, () => savedAt);
    if (ok) persistedRef.current = { revision: data.revision, savedAt };
    setSaveStatus(ok ? 'saved' : 'failed');
  }, [cancelTimer, storage]);

  // 変更をデバウンスして書き込む。連続入力（set-calculation 等）で毎回 setItem しない。
  useEffect(() => {
    latestRef.current = save;
    if (save.revision === persistedRef.current.revision) return;
    timerRef.current = setTimeout(flush, debounceMs);
    return cancelTimer;
  }, [save, flush, cancelTimer, debounceMs]);

  // アンマウント時・ページ離脱時は待たずに書く。
  useEffect(() => flush, [flush]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onLeave = () => flush();
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [flush]);

  // 他タブの保存を取り込む（競合ポリシーは saveCoordinator.ts）。
  useEffect(() => {
    if (!storage || typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      if (e.newValue === null) {
        // 他タブが記録を削除した（resetAll / clear）。自タブも初期状態に合わせる。
        cancelTimer();
        persistedRef.current = { revision: 0, savedAt: null };
        setSave(createSaveData(FIRST_CASE));
        return;
      }
      const remote = parseStoredSaveData(e.newValue, FIRST_CASE);
      if (!remote) return;
      const local = { revision: latestRef.current.revision, savedAt: persistedRef.current.savedAt };
      if (!remote.readOnlyVersion && resolveConflict(local, remote) !== 'take-remote') return;
      if (remote.readOnlyVersion) setSaveStatus('read-only');
      const { savedAt, ...data } = remote;
      cancelTimer();
      persistedRef.current = { revision: data.revision, savedAt };
      setSave(sanitize(data));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storage, cancelTimer]);

  /** 変更があれば revision を進めて state を更新する。 */
  const update = useCallback((fn: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      return { ...next, revision: nextRevision(prev.revision) };
    });
  }, []);

  const current = useMemo(() => findCase(save.active) ?? CASES[0]!, [save.active]);
  const progress = save.progress[current.id] ?? createProgress(current);

  const dispatch = useCallback(
    (action: GameAction) => {
      update((prev) => {
        const caseData = findCase(prev.active);
        if (!caseData) return prev;
        const before = prev.progress[caseData.id] ?? createProgress(caseData);
        const after = reduceProgress(caseData, before, action);
        let session = prev.session;
        if (action.type === 'reset') {
          session = createSession();
        } else if (
          action.type === 'open-document' &&
          after.opened.includes(action.documentId) &&
          session.lastDocumentId !== action.documentId
        ) {
          session = { ...session, lastDocumentId: action.documentId };
        }
        if (after === before && session === prev.session) return prev;
        const finished = { ...prev.finished };
        if (after.published && evaluateCase(caseData, after).cleared) finished[caseData.id] = true;
        const next: SaveData = {
          ...prev,
          progress: { ...prev.progress, [caseData.id]: after },
          ...(caseData.v2
            ? {
                gameVersion: 2 as const,
                caseRevisions: { ...prev.caseRevisions, [caseData.id]: caseData.v2.revision },
              }
            : {}),
          finished,
          session,
        };
        return action.type === 'reset' ? resetCaseProgress(next, caseData.id) : next;
      });
    },
    [update],
  );

  const selectCase = useCallback(
    (id: string) => {
      if (!findCase(id)) return;
      update((prev) => {
        const fresh = createSession();
        if (
          prev.active === id &&
          prev.session.stage === fresh.stage &&
          prev.session.lastDocumentId === fresh.lastDocumentId
        ) {
          return prev;
        }
        return { ...prev, active: id, session: fresh };
      });
    },
    [update],
  );

  const setStage = useCallback(
    (stage: Stage) => {
      update((prev) =>
        prev.session.stage === stage ? prev : { ...prev, session: { ...prev.session, stage } },
      );
    },
    [update],
  );

  const setLastDocument = useCallback(
    (documentId: string | null) => {
      update((prev) =>
        prev.session.lastDocumentId === documentId
          ? prev
          : { ...prev, session: { ...prev.session, lastDocumentId: documentId } },
      );
    },
    [update],
  );

  const goToNextCase = useCallback(() => {
    const next = nextCaseId(current.id);
    if (next) selectCase(next);
  }, [current.id, selectCase]);

  const resetAll = useCallback(() => {
    cancelTimer();
    clearSaveData(storage);
    persistedRef.current = { revision: 0, savedAt: null };
    setSave(createSaveData(FIRST_CASE));
    setSaveStatus(storage ? 'saved' : 'unavailable');
  }, [cancelTimer, storage]);

  return {
    migrationNotice: save.migrationNotice,
    legacyFinished: save.legacyFinished,
    cases: CASES,
    current,
    progress,
    stage: save.session.stage,
    finished: save.finished,
    progressByCase: save.progress,
    dispatch,
    selectCase,
    setStage,
    goToNextCase,
    resetAll,
    saveStatus,
    lastDocumentId: save.session.lastDocumentId,
    setLastDocument,
  };
}
