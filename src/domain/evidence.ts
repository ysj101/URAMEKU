import type { CaseProgress } from './types';

/** 未閲覧資料は採用できない。採用済みなら重複しない。 */
export function pinDocument(progress: CaseProgress, documentId: string): CaseProgress {
  if (!progress.opened.includes(documentId)) return progress;
  if (progress.pinned.includes(documentId)) return progress;
  return { ...progress, pinned: [...progress.pinned, documentId] };
}

/** 取り下げると照合の選択からも外れる。 */
export function unpinDocument(progress: CaseProgress, documentId: string): CaseProgress {
  if (!progress.pinned.includes(documentId)) return progress;
  return {
    ...progress,
    pinned: progress.pinned.filter((id) => id !== documentId),
    chosenLink: progress.chosenLink.filter((id) => id !== documentId),
  };
}

export function togglePin(progress: CaseProgress, documentId: string): CaseProgress {
  return progress.pinned.includes(documentId)
    ? unpinDocument(progress, documentId)
    : pinDocument(progress, documentId);
}
