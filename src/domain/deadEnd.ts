/**
 * 調査予算の「詰み」判定。
 *
 * 詰み = クリアに必要な資料（required_evidence と required_link の和集合）のうち
 * 未閲覧のものを、残予算ではすべて開けなくなった状態。
 * budget.ts（MVP-007 で並行変更中）には依存せず、残予算の算出のみ借りる。
 */
import { remainingBudget } from './budget';
import type { CaseData, CaseDocument, CaseProgress } from './types';

export interface DeadEndReason {
  /** 詰みかどうか */
  deadEnd: boolean;
  /** 残り調査予算 */
  remaining: number;
  /** 未閲覧の必要資料（JSON の documents 順） */
  missing: CaseDocument[];
  /** 未閲覧の必要資料をすべて開くのに必要なコスト */
  missingCost: number;
  /** 不足分（残予算で足りていれば 0） */
  shortfall: number;
}

/** クリアに必要な資料 ID の和集合（documents 順。JSON に無い ID は無視） */
export function requiredDocumentIds(caseData: CaseData): string[] {
  const needed = new Set<string>([...caseData.required_evidence, ...caseData.required_link]);
  return caseData.documents.filter((d) => needed.has(d.id)).map((d) => d.id);
}

export function deadEndReason(caseData: CaseData, progress: CaseProgress): DeadEndReason {
  const needed = new Set(requiredDocumentIds(caseData));
  const missing = caseData.documents.filter(
    (d) => needed.has(d.id) && !progress.opened.includes(d.id),
  );
  const missingCost = missing.reduce((sum, d) => sum + d.cost, 0);
  const remaining = remainingBudget(caseData, progress);
  const shortfall = Math.max(0, missingCost - remaining);
  return { deadEnd: shortfall > 0, remaining, missing, missingCost, shortfall };
}

export function isDeadEnd(caseData: CaseData, progress: CaseProgress): boolean {
  return deadEndReason(caseData, progress).deadEnd;
}
