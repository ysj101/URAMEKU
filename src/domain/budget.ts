import type { CaseData, CaseProgress } from './types';

/** 閲覧済み資料のコスト合計 */
export function spentBudget(caseData: CaseData, progress: CaseProgress): number {
  return caseData.documents
    .filter((d) => progress.opened.includes(d.id))
    .reduce((sum, d) => sum + d.cost, 0);
}

/** 残り調査予算 */
export function remainingBudget(caseData: CaseData, progress: CaseProgress): number {
  return caseData.budget - spentBudget(caseData, progress);
}

/**
 * 資料を開けるか。閲覧済みなら常に可（再読はコスト 0）。
 * 未閲覧なら残予算がコスト以上であること。
 */
export function canOpenDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): boolean {
  const doc = caseData.documents.find((d) => d.id === documentId);
  if (!doc) return false;
  if (progress.opened.includes(documentId)) return true;
  return remainingBudget(caseData, progress) >= doc.cost;
}

/**
 * 資料を開く。開けない場合は状態を変えずに同じ参照を返す。
 */
export function openDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): CaseProgress {
  if (progress.opened.includes(documentId)) return progress;
  if (!canOpenDocument(caseData, progress, documentId)) return progress;
  return { ...progress, opened: [...progress.opened, documentId] };
}
