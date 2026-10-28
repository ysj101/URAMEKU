import { LINK_SIZE, type CaseData, type CaseProgress, type V2EvidenceLink } from './types';

/**
 * 2 資料照合のルール。
 * - 照合に使えるのは開いて読んだ資料だけ
 * - 自己照合（同じ資料 2 枚）は成立しない
 * - 提出後は選択を変えられない
 * - 正誤は required_link との集合一致（順不同）
 */

export type LinkSelectReason = 'not-opened' | 'unknown-document' | 'published';

export type LinkSelectResult = { ok: true } | { ok: false; reason: LinkSelectReason };

export type LinkStatus = 'incomplete' | 'correct' | 'incorrect';

/**
 * 資料を照合対象として選択（または解除）できるか。
 * 解除も同じ判定を通るため、提出済みなら解除もできない。
 */
export function canSelectForLink(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): LinkSelectResult {
  if (progress.published) return { ok: false, reason: 'published' };
  if (!caseData.documents.some((d) => d.id === documentId)) {
    return { ok: false, reason: 'unknown-document' };
  }
  if (!progress.opened.includes(documentId)) return { ok: false, reason: 'not-opened' };
  return { ok: true };
}

/**
 * 照合対象の選択を切り替える。
 * - 選べない資料（canSelectForLink が ok でない）なら変更なし
 * - 選択済みなら解除（同一 ID を 2 回押しても自己照合にはならない）
 * - すでに 2 枚選んでいる状態で 3 枚目を押すと、その 1 枚から選び直す
 */
export function toggleLinkSelection(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): CaseProgress {
  if (!canSelectForLink(caseData, progress, documentId).ok) return progress;
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

/**
 * ケース定義の required_link が「異なる 2 枚」として成立しているか。
 * 成立しないデータは常に不正解扱いにする（正解を作れないケースを正解にしない）。
 * データそのものの検証・警告は validateCase（MVP-006）の責務で、ここでは防御のみ行う。
 */
function hasValidRequiredLink(caseData: CaseData): boolean {
  const required = caseData.required_link;
  return required.length === LINK_SIZE && new Set(required).size === LINK_SIZE;
}

/** 選択中の 2 枚が required_link と（順不同で）一致するか */
export function isLinkCorrect(caseData: CaseData, progress: CaseProgress): boolean {
  if (!isLinkComplete(progress)) return false;
  if (!hasValidRequiredLink(caseData)) return false;
  const chosen = new Set(progress.chosenLink);
  return caseData.required_link.every((id) => chosen.has(id));
}

/**
 * 照合の状態。
 * - incomplete: 異なる 2 枚がまだ揃っていない
 * - correct: 2 枚が required_link と一致
 * - incorrect: 2 枚揃っているが一致しない（required_link が不正なデータでも incorrect）
 */
export function linkStatus(caseData: CaseData, progress: CaseProgress): LinkStatus {
  if (!isLinkComplete(progress)) return 'incomplete';
  return isLinkCorrect(caseData, progress) ? 'correct' : 'incorrect';
}

/** V2 relations keep direction and role; a matching pair alone is insufficient. */
export function sameEvidenceLink(a: V2EvidenceLink, b: V2EvidenceLink): boolean {
  return a.from === b.from && a.to === b.to && a.relation === b.relation;
}

export function validV2Links(caseData: CaseData, progress: CaseProgress) {
  return (progress.v2?.links ?? []).filter(
    (link) =>
      link.from !== link.to &&
      [link.from, link.to].every(
        (id) =>
          caseData.documents.some((document) => document.id === id) && progress.opened.includes(id),
      ),
  );
}

/** Any full authored path is valid. Alternative paths are not forced into the first path. */
export function v2GraphProgress(caseData: CaseData, progress: CaseProgress) {
  const links = validV2Links(caseData, progress);
  const paths = caseData.v2?.graph.paths ?? [];
  const counts = paths.map((path) => ({
    done: path.filter((required) => links.some((link) => sameEvidenceLink(link, required))).length,
    total: path.length,
  }));
  return (
    counts.find((count) => count.total > 0 && count.done === count.total) ??
    counts.sort((a, b) => b.done / b.total - a.done / a.total)[0] ?? { done: 0, total: 1 }
  );
}

export function v2GraphComplete(caseData: CaseData, progress: CaseProgress): boolean {
  const count = v2GraphProgress(caseData, progress);
  return count.total > 0 && count.done === count.total;
}
