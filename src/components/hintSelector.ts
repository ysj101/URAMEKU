import type { UI } from '../data/ui';
import { ARTICLE_LENGTH, LINK_SIZE, type CaseData, type CaseProgress } from '../domain/types';
import type { Stage } from '../state/migrations';

export type HintKey = keyof Omit<typeof UI.tutorial.hint, 'label' | 'dismiss' | 'dismissNote'>;

/**
 * 進行状態から次に取るべき操作の 1 行ヒントを選ぶ（純粋関数）。
 * 正解の資料名・数値・断片は決して出さない。提出済みなら null。
 */
export function hintFor(caseData: CaseData, progress: CaseProgress, stage: Stage): HintKey | null {
  if (progress.published) return null;
  if (stage === 'article') {
    return progress.article.length < ARTICLE_LENGTH ? 'fragments' : 'submit';
  }
  if (progress.opened.length === 0) return 'open';
  if (progress.pinned.length === 0) return 'pin';
  if (progress.pinned.length < LINK_SIZE) return 'pinMore';
  if (progress.chosenLink.length < LINK_SIZE) return 'link';
  const unanswered = caseData.analysis_tasks.some(
    (task) => (progress.calculations[task.id] ?? '').trim() === '',
  );
  if (unanswered) return 'calculate';
  return 'toArticle';
}
