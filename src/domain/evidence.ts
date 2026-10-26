/**
 * 証拠ボード（採用・取り下げ）の状態遷移。
 *
 * 1 資料の状態は `CaseProgress.opened` / `pinned` / `chosenLink` の組み合わせで表す。
 *
 * | 現在の状態 | 操作        | 結果                         | 備考                                   |
 * |------------|-------------|------------------------------|----------------------------------------|
 * | 未読       | pin         | 変化なし（`not-opened`）     | 閲覧していない資料は採用できない       |
 * | 未読       | open        | 閲覧済み                     | budget.ts の `openDocument` が担当     |
 * | 閲覧済み   | pin         | 採用（`pinned` 末尾に追加）  |                                        |
 * | 採用       | pin         | 変化なし（`already-pinned`） | 重複して積まれない                     |
 * | 採用       | unpin       | 閲覧済み（取り下げ）         | `chosenLink` からも外れる              |
 * | 取り下げ   | pin         | 採用（`pinned` 末尾に追加）  | `chosenLink` は復元しない（再選択必要）|
 * | 閲覧済み   | unpin       | 変化なし（`not-pinned`）     |                                        |
 * | 任意       | pin / unpin | 変化なし（`published`）      | 提出済みはボードを凍結。`withdraw` 後に編集 |
 * | 任意       | pin / unpin | 変化なし（`unknown-document`）| 事件に存在しない ID（caseData を渡した場合） |
 *
 * 「取り下げ」は独立した状態ではなく「閲覧済み（opened に残り pinned に無い）」と同じ。
 * 閲覧履歴は消えないので、再採用に追加コストはかからない。
 */
import type { CaseData, CaseProgress } from './types';

export type PinRejectReason = 'not-opened' | 'already-pinned' | 'unknown-document' | 'published';
export type UnpinRejectReason = 'not-pinned' | 'unknown-document' | 'published';

export type EvidenceCheck<R extends string> =
  { ok: true; reason?: undefined } | { ok: false; reason: R };

function hasDocument(caseData: CaseData, documentId: string): boolean {
  return caseData.documents.some((d) => d.id === documentId);
}

/** 採用できるか。できない場合は理由を返す（UI の無効化表示などに使う） */
export function canPinDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): EvidenceCheck<PinRejectReason> {
  if (!hasDocument(caseData, documentId)) return { ok: false, reason: 'unknown-document' };
  if (progress.published) return { ok: false, reason: 'published' };
  if (!progress.opened.includes(documentId)) return { ok: false, reason: 'not-opened' };
  if (progress.pinned.includes(documentId)) return { ok: false, reason: 'already-pinned' };
  return { ok: true };
}

/** 取り下げできるか。できない場合は理由を返す */
export function canUnpinDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): EvidenceCheck<UnpinRejectReason> {
  if (!hasDocument(caseData, documentId)) return { ok: false, reason: 'unknown-document' };
  if (progress.published) return { ok: false, reason: 'published' };
  if (!progress.pinned.includes(documentId)) return { ok: false, reason: 'not-pinned' };
  return { ok: true };
}

function isCaseData(value: CaseData | CaseProgress): value is CaseData {
  return Array.isArray((value as CaseData).documents);
}

/**
 * 採用する。未閲覧・採用済み・提出済みなら同じ参照を返す。
 * `caseData` を渡した版は、事件に存在しない ID も拒否する。
 */
export function pinDocument(progress: CaseProgress, documentId: string): CaseProgress;
export function pinDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): CaseProgress;
export function pinDocument(
  first: CaseData | CaseProgress,
  second: CaseProgress | string,
  third?: string,
): CaseProgress {
  if (isCaseData(first)) {
    const progress = second as CaseProgress;
    const documentId = third as string;
    return canPinDocument(first, progress, documentId).ok
      ? appendPin(progress, documentId)
      : progress;
  }
  const progress = first;
  const documentId = second as string;
  if (progress.published) return progress;
  if (!progress.opened.includes(documentId)) return progress;
  if (progress.pinned.includes(documentId)) return progress;
  return appendPin(progress, documentId);
}

function appendPin(progress: CaseProgress, documentId: string): CaseProgress {
  return { ...progress, pinned: [...progress.pinned, documentId] };
}

/**
 * 取り下げる。照合の選択（`chosenLink`）からも外れる。
 * 採用していない・提出済みなら同じ参照を返す。
 */
export function unpinDocument(progress: CaseProgress, documentId: string): CaseProgress;
export function unpinDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): CaseProgress;
export function unpinDocument(
  first: CaseData | CaseProgress,
  second: CaseProgress | string,
  third?: string,
): CaseProgress {
  if (isCaseData(first)) {
    const progress = second as CaseProgress;
    const documentId = third as string;
    return canUnpinDocument(first, progress, documentId).ok
      ? removePin(progress, documentId)
      : progress;
  }
  const progress = first;
  const documentId = second as string;
  if (progress.published) return progress;
  if (!progress.pinned.includes(documentId)) return progress;
  return removePin(progress, documentId);
}

function removePin(progress: CaseProgress, documentId: string): CaseProgress {
  return {
    ...progress,
    pinned: progress.pinned.filter((id) => id !== documentId),
    chosenLink: progress.chosenLink.filter((id) => id !== documentId),
    ...(progress.v2
      ? {
          v2: {
            ...progress.v2,
            decoding: Object.fromEntries(
              Object.entries(progress.v2.decoding).map(([id, record]) => [
                id,
                { ...record, evidence: record.evidence.filter((source) => source !== documentId) },
              ]),
            ),
            links: progress.v2.links.filter(
              (link) => link.from !== documentId && link.to !== documentId,
            ),
          },
        }
      : {}),
  };
}

/** 採用済みなら取り下げ、そうでなければ採用する */
export function togglePin(progress: CaseProgress, documentId: string): CaseProgress;
export function togglePin(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): CaseProgress;
export function togglePin(
  first: CaseData | CaseProgress,
  second: CaseProgress | string,
  third?: string,
): CaseProgress {
  if (isCaseData(first)) {
    const progress = second as CaseProgress;
    const documentId = third as string;
    return progress.pinned.includes(documentId)
      ? unpinDocument(first, progress, documentId)
      : pinDocument(first, progress, documentId);
  }
  const progress = first;
  const documentId = second as string;
  return progress.pinned.includes(documentId)
    ? unpinDocument(progress, documentId)
    : pinDocument(progress, documentId);
}
