import {
  ARTICLE_LENGTH,
  type CaseData,
  type CaseProgress,
  type FragmentKind,
  type HeadlineFragment,
} from './types';

export function addFragment(progress: CaseProgress, fragmentId: string): CaseProgress {
  if (progress.article.length >= ARTICLE_LENGTH) return progress;
  if (progress.article.includes(fragmentId)) return progress;
  return { ...progress, article: [...progress.article, fragmentId] };
}

export function removeFragmentAt(progress: CaseProgress, index: number): CaseProgress {
  if (index < 0 || index >= progress.article.length) return progress;
  return { ...progress, article: progress.article.filter((_, i) => i !== index) };
}

export function isArticleComplete(progress: CaseProgress): boolean {
  return progress.article.length === ARTICLE_LENGTH;
}

/** 正しい位置に置かれた断片の数（順序を加味） */
export function countFragmentsInPlace(caseData: CaseData, progress: CaseProgress): number {
  return progress.article.filter((id, i) => caseData.correct_fragments[i] === id).length;
}

/** 3 断片がすべて正しい順序で並んでいるか */
export function isArticleCorrect(caseData: CaseData, progress: CaseProgress): boolean {
  return (
    isArticleComplete(progress) &&
    caseData.correct_fragments.length === ARTICLE_LENGTH &&
    caseData.correct_fragments.every((id, i) => progress.article[i] === id)
  );
}

/**
 * スロットごとの採点結果。
 * - correct: 正しい断片が正しい位置にある
 * - wrong-position: 正しい断片だが位置が違う
 * - incorrect: 誤った断片
 * - empty: まだ置かれていない
 */
export type FragmentStatus = 'correct' | 'wrong-position' | 'incorrect' | 'empty';

export interface FragmentFeedback {
  /** スロット番号（0 〜 ARTICLE_LENGTH − 1） */
  index: number;
  fragmentId?: string;
  status: FragmentStatus;
  /** 断片データに kind があれば転記する（empty では付かない） */
  kind?: FragmentKind;
  /** 断片データに reason があれば転記する（empty では付かない） */
  reason?: string;
  /** reason の根拠資料 ID */
  evidence?: string[];
}

export function findFragment(caseData: CaseData, fragmentId: string): HeadlineFragment | undefined {
  return caseData.headline_fragments.find((f) => f.id === fragmentId);
}

/**
 * 見出し 3 スロットそれぞれの採点と誤誘導理由。常に ARTICLE_LENGTH 件を返す。
 * 判定は correct_fragments のみに依存し、断片の kind は表示用の付加情報として転記する
 * （kind が 'correct' でも correct_fragments に無ければ incorrect になる。整合は validateCase が担保）。
 */
export function fragmentFeedback(caseData: CaseData, progress: CaseProgress): FragmentFeedback[] {
  return Array.from({ length: ARTICLE_LENGTH }, (_, index) => {
    const fragmentId = progress.article[index];
    if (fragmentId === undefined) return { index, status: 'empty' as const };
    let status: FragmentStatus;
    if (caseData.correct_fragments[index] === fragmentId) status = 'correct';
    else if (caseData.correct_fragments.includes(fragmentId)) status = 'wrong-position';
    else status = 'incorrect';
    const fragment = findFragment(caseData, fragmentId);
    const feedback: FragmentFeedback = { index, fragmentId, status };
    if (fragment?.kind !== undefined) feedback.kind = fragment.kind;
    if (fragment?.reason !== undefined) feedback.reason = fragment.reason;
    if (fragment?.evidence !== undefined) feedback.evidence = [...fragment.evidence];
    return feedback;
  });
}

/* ------------------------------------------------------------------
 * 編集操作（MVP-025）。既存の addFragment / removeFragmentAt は変更しない。
 * ------------------------------------------------------------------ */

/**
 * スロット index の断片を fragmentId に差し替える。
 * - index が既存スロットの直後（= article.length）なら追加として扱う
 * - 範囲外、または同じ断片がすでに別のスロットにある場合は変更しない
 */
export function replaceFragmentAt(
  progress: CaseProgress,
  index: number,
  fragmentId: string,
): CaseProgress {
  if (!Number.isInteger(index) || index < 0 || index >= ARTICLE_LENGTH) return progress;
  if (index >= progress.article.length) return addFragment(progress, fragmentId);
  if (progress.article[index] === fragmentId) return progress;
  if (progress.article.includes(fragmentId)) return progress;
  const article = progress.article.map((id, i) => (i === index ? fragmentId : id));
  return { ...progress, article };
}

/** スロット from の断片を to の位置へ移す（間の断片は詰める）。範囲外なら変更しない */
export function moveFragment(progress: CaseProgress, from: number, to: number): CaseProgress {
  const len = progress.article.length;
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < len;
  if (!inRange(from) || !inRange(to) || from === to) return progress;
  const article = [...progress.article];
  const [moved] = article.splice(from, 1);
  article.splice(to, 0, moved as string);
  return { ...progress, article };
}

/** 見出しの 3 スロットをすべて空にする */
export function clearArticle(progress: CaseProgress): CaseProgress {
  if (progress.article.length === 0) return progress;
  return { ...progress, article: [] };
}
