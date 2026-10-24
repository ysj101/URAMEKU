import { ARTICLE_LENGTH, type CaseData, type CaseProgress } from './types';

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
