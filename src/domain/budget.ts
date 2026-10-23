/**
 * 調査予算と資料取得のルール（docs/GAME_RULES.md 2 章）。
 *
 * - 資料閲覧時にコストを消費する。コスト 0 の資料は予算 0 でも開ける。
 * - 一度閲覧済みの資料は再読でコスト消費なし。
 * - 残予算がコストに満たない資料は開けない。
 *
 * すべて純粋関数。DOM や保存処理に依存しない。
 */
import type { CaseData, CaseDocument, CaseProgress } from './types';

/** 資料を開こうとした結果 */
export type OpenDocumentOutcome =
  'opened' | 'already-open' | 'insufficient-budget' | 'unknown-document';

export interface OpenDocumentResult {
  progress: CaseProgress;
  outcome: OpenDocumentOutcome;
}

/**
 * 資料コストを計算に使える値へ正規化する。
 * 負・非整数・NaN など不正な値は 0 として扱い、例外にしない。
 * 不正データの検出・拒否は validateCase（データ読込側）の責務。
 */
export function documentCost(doc: Pick<CaseDocument, 'cost'>): number {
  const { cost } = doc;
  return typeof cost === 'number' && Number.isInteger(cost) && cost >= 0 ? cost : 0;
}

/** 事件の総予算。不正値は 0 として扱う（検証は validateCase 側） */
function caseBudget(caseData: CaseData): number {
  const { budget } = caseData;
  return typeof budget === 'number' && Number.isFinite(budget) && budget >= 0 ? budget : 0;
}

function findDocument(caseData: CaseData, documentId: string): CaseDocument | undefined {
  return caseData.documents.find((d) => d.id === documentId);
}

/**
 * 閲覧済み資料のコスト合計。
 * `opened` に存在しない ID や重複が混ざっていても、事件データ側の資料を基準に
 * 集計するため壊れない（存在しない ID は無視、重複は 1 回だけ数える）。
 */
export function spentBudget(caseData: CaseData, progress: CaseProgress): number {
  return caseData.documents
    .filter((d) => progress.opened.includes(d.id))
    .reduce((sum, d) => sum + documentCost(d), 0);
}

/** 残り調査予算 */
export function remainingBudget(caseData: CaseData, progress: CaseProgress): number {
  return caseBudget(caseData) - spentBudget(caseData, progress);
}

/**
 * 資料を開こうとし、新しい進行状態と「開けた／開けなかった理由」を返す。
 * 開けない場合（または既に閲覧済みの場合）は状態を変えずに同じ参照を返す。
 */
export function tryOpenDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): OpenDocumentResult {
  const doc = findDocument(caseData, documentId);
  if (!doc) return { progress, outcome: 'unknown-document' };
  if (progress.opened.includes(documentId)) return { progress, outcome: 'already-open' };
  if (remainingBudget(caseData, progress) < documentCost(doc)) {
    return { progress, outcome: 'insufficient-budget' };
  }
  return { progress: { ...progress, opened: [...progress.opened, documentId] }, outcome: 'opened' };
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
  const { outcome } = tryOpenDocument(caseData, progress, documentId);
  return outcome === 'opened' || outcome === 'already-open';
}

/**
 * 資料を開く。開けない場合は状態を変えずに同じ参照を返す。
 * 理由が必要なら tryOpenDocument を使う。
 */
export function openDocument(
  caseData: CaseData,
  progress: CaseProgress,
  documentId: string,
): CaseProgress {
  return tryOpenDocument(caseData, progress, documentId).progress;
}

/** 未閲覧かつ残予算で開ける資料（事件データの並び順） */
export function affordableDocuments(caseData: CaseData, progress: CaseProgress): CaseDocument[] {
  const remaining = remainingBudget(caseData, progress);
  return caseData.documents.filter(
    (d) => !progress.opened.includes(d.id) && documentCost(d) <= remaining,
  );
}

/**
 * 必要証拠のうち未閲覧の資料。
 * required_evidence に存在しない ID が含まれていても無視する（検証は validateCase 側）。
 */
export function unopenedRequiredDocuments(
  caseData: CaseData,
  progress: CaseProgress,
): CaseDocument[] {
  return caseData.required_evidence
    .map((id) => findDocument(caseData, id))
    .filter((d): d is CaseDocument => d !== undefined && !progress.opened.includes(d.id));
}

/**
 * 行き詰まり判定。必要証拠のうち未閲覧のものを残予算では開き切れない状態なら true。
 * 単体では開ける資料でも、未閲覧の必要証拠の合計コストが残予算を超えていれば
 * 事件を解き切れないので行き詰まりとみなす。
 * 必要証拠をすべて閲覧済みなら false。事件リセットで再挑戦可能。
 */
export function isDeadEnd(caseData: CaseData, progress: CaseProgress): boolean {
  const needed = unopenedRequiredDocuments(caseData, progress).reduce(
    (sum, d) => sum + documentCost(d),
    0,
  );
  return needed > remainingBudget(caseData, progress);
}
