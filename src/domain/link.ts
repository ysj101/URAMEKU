import { LINK_SIZE, type CaseData, type CaseProgress } from './types';

/**
 * 照合対象の選択を切り替える。
 * - ボードに採用していない資料は選べない
 * - 選択済みなら解除
 * - すでに 2 枚選んでいる状態で 3 枚目を押すと、その 1 枚から選び直す
 */
export function toggleLinkSelection(progress: CaseProgress, documentId: string): CaseProgress {
  if (!progress.pinned.includes(documentId)) return progress;
  if (progress.chosenLink.includes(documentId)) {
    return { ...progress, chosenLink: progress.chosenLink.filter((id) => id !== documentId) };
  }
  if (progress.chosenLink.length >= LINK_SIZE) {
    return { ...progress, chosenLink: [documentId] };
  }
  return { ...progress, chosenLink: [...progress.chosenLink, documentId] };
}

/** 異なる 2 枚が選ばれているか */
export function isLinkComplete(progress: CaseProgress): boolean {
  return (
    progress.chosenLink.length === LINK_SIZE && new Set(progress.chosenLink).size === LINK_SIZE
  );
}

/** 選択中の 2 枚が required_link と（順不同で）一致するか */
export function isLinkCorrect(caseData: CaseData, progress: CaseProgress): boolean {
  if (!isLinkComplete(progress)) return false;
  const chosen = new Set(progress.chosenLink);
  return (
    caseData.required_link.length === LINK_SIZE &&
    caseData.required_link.every((id) => chosen.has(id))
  );
}
