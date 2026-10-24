/**
 * 事件進行の状態遷移をひとつの reducer にまとめる。
 * 個別のルールは budget / evidence / link / calculation / article / publish に分離。
 */
import { addFragment, removeFragmentAt } from './article';
import { openDocument } from './budget';
import { setCalculation } from './calculation';
import { togglePin } from './evidence';
import { toggleLinkSelection } from './link';
import { revealAnswer, submitArticle, withdrawArticle } from './publish';
import type { CaseData, CaseProgress } from './types';

export function createProgress(): CaseProgress {
  return {
    opened: [],
    pinned: [],
    chosenLink: [],
    calculations: {},
    article: [],
    published: false,
    revealed: false,
  };
}

export type GameAction =
  | { type: 'open-document'; documentId: string }
  | { type: 'toggle-pin'; documentId: string }
  | { type: 'toggle-link'; documentId: string }
  | { type: 'set-calculation'; taskId: string; value: string }
  | { type: 'add-fragment'; fragmentId: string }
  | { type: 'remove-fragment'; index: number }
  | { type: 'submit' }
  | { type: 'withdraw' }
  | { type: 'reveal' }
  | { type: 'reset' };

export function reduceProgress(
  caseData: CaseData,
  progress: CaseProgress,
  action: GameAction,
): CaseProgress {
  switch (action.type) {
    case 'open-document':
      return openDocument(caseData, progress, action.documentId);
    case 'toggle-pin':
      return togglePin(progress, action.documentId);
    case 'toggle-link':
      return toggleLinkSelection(caseData, progress, action.documentId);
    case 'set-calculation':
      return setCalculation(progress, action.taskId, action.value);
    case 'add-fragment':
      return addFragment(progress, action.fragmentId);
    case 'remove-fragment':
      return removeFragmentAt(progress, action.index);
    case 'submit':
      return submitArticle(progress);
    case 'withdraw':
      return withdrawArticle(progress);
    case 'reveal':
      return revealAnswer(progress);
    case 'reset':
      return createProgress();
  }
}

/** 保存データなどから読み込んだ値を安全な形に正規化する */
export function normalizeProgress(raw: unknown): CaseProgress {
  const base = createProgress();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const strArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const calculations: Record<string, string> = {};
  if (r.calculations && typeof r.calculations === 'object') {
    for (const [k, v] of Object.entries(r.calculations as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') calculations[k] = String(v);
    }
  }
  return {
    opened: strArray(r.opened),
    pinned: strArray(r.pinned),
    chosenLink: strArray(r.chosenLink).slice(0, 2),
    calculations,
    article: strArray(r.article).slice(0, 3),
    published: r.published === true,
    revealed: r.revealed === true,
  };
}
