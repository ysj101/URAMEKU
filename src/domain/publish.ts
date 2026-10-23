import { countFragmentsInPlace, isArticleComplete, isArticleCorrect } from './article';
import { countCorrectCalculations } from './calculation';
import { isLinkCorrect } from './link';
import { ARTICLE_LENGTH, LINK_SIZE, type CaseData, type CaseProgress } from './types';

/** 掲載可否を構成する 4 系統の根拠 */
export type VerdictTrack = 'evidence' | 'link' | 'calculation' | 'article';

export const VERDICT_TRACKS: readonly VerdictTrack[] = [
  'evidence',
  'link',
  'calculation',
  'article',
] as const;

/** 各系統の達成数と総数 */
export interface TrackDetail {
  done: number;
  total: number;
}

export interface PublishVerdict {
  /** 4 系統すべてが揃っているときだけ true */
  approved: boolean;
  /** 揃っていない系統（VERDICT_TRACKS の順） */
  missing: VerdictTrack[];
  detail: {
    /** 必要証拠（required_evidence）のうちボードに採用済みの数 */
    evidence: TrackDetail;
    /** 照合（required_link と一致していれば 1/1） */
    link: TrackDetail;
    /** 数値検証メモ（analysis_tasks のうち許容誤差内の数） */
    calculation: TrackDetail;
    /** 記事（correct_fragments と同じ位置に置かれた断片の数） */
    article: TrackDetail;
  };
}

/**
 * 掲載可否の一元判定。docs/GAME_RULES.md 7 章「クリア」に対応する。
 *
 *   クリア = すべての必要証拠を採用
 *            AND 必要な照合成立
 *            AND 数値検証メモが全問正しい
 *            AND 見出しの 3 断片がすべて正しく並んでいる
 *
 * 設計上の約束:
 * - 判定は `CaseData`（正解キー）と `CaseProgress`（プレイヤーの選択）のみに依存し、
 *   画面の状態や提出済み・公開済みフラグ（`published` / `revealed`）には依存しない。
 *   UI は本関数の結果を表示するだけで、独自に合否を再計算しない。
 * - 系統ごとの達成数は `CaseData` 側の定義から総数を取る（`required_evidence.length`、
 *   `analysis_tasks.length`、`ARTICLE_LENGTH`）。将来「複数の有効な結論」や
 *   「関係ラベル付きの照合」を導入する場合も、`CaseData` の定義を拡張して
 *   この関数内で解釈を閉じ、呼び出し側のシグネチャは変えない方針とする。
 * - 点数計算は `scoring.ts` が担当し、合否はこの関数に委譲する。
 */
export function publishVerdict(caseData: CaseData, progress: CaseProgress): PublishVerdict {
  const evidenceDone = caseData.required_evidence.filter((id) =>
    progress.pinned.includes(id),
  ).length;
  const linkOk = isLinkCorrect(caseData, progress);
  const calcDone = countCorrectCalculations(caseData, progress);
  const articleOk = isArticleCorrect(caseData, progress);

  const detail: PublishVerdict['detail'] = {
    evidence: { done: evidenceDone, total: caseData.required_evidence.length },
    link: { done: linkOk ? 1 : 0, total: caseData.required_link.length === LINK_SIZE ? 1 : 0 },
    calculation: { done: calcDone, total: caseData.analysis_tasks.length },
    article: { done: countFragmentsInPlace(caseData, progress), total: ARTICLE_LENGTH },
  };

  const satisfied: Record<VerdictTrack, boolean> = {
    evidence: evidenceDone === caseData.required_evidence.length,
    link: linkOk,
    calculation: calcDone === caseData.analysis_tasks.length,
    article: articleOk,
  };
  const missing = VERDICT_TRACKS.filter((t) => !satisfied[t]);

  return { approved: missing.length === 0, missing, detail };
}

/** 提出操作が可能か（評価の合否とは別。3 断片が揃っていれば提出できる） */
export function canSubmitArticle(progress: CaseProgress): boolean {
  return isArticleComplete(progress) && !progress.published;
}

export function submitArticle(progress: CaseProgress): CaseProgress {
  if (!canSubmitArticle(progress)) return progress;
  return { ...progress, published: true };
}

/** 提出を取り下げて編集に戻る */
export function withdrawArticle(progress: CaseProgress): CaseProgress {
  if (!progress.published) return progress;
  return { ...progress, published: false };
}

export function revealAnswer(progress: CaseProgress): CaseProgress {
  if (progress.revealed) return progress;
  return { ...progress, revealed: true };
}
