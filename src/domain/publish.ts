import { isArticleComplete } from './article';
import type { CaseProgress } from './types';

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
