/**
 * 事件進行の状態遷移をひとつの reducer にまとめる。
 * 個別のルールは budget / link / calculation / article / publish に分離。
 * 資料は開いた時点で根拠候補になる（証拠ボードに「貼る」操作はない）。
 */
import {
  addFragment,
  clearArticle,
  moveFragment,
  removeFragmentAt,
  replaceFragmentAt,
} from './article';
import { openDocument } from './budget';
import { setCalculation } from './calculation';
import { toggleLinkSelection } from './link';
import { revealAnswer, submitArticle, withdrawArticle } from './publish';
import type { CaseData, CaseProgress, V2Action } from './types';
import { createV2Progress, normalizeV2Progress, reduceV2Progress } from './v2Progress';

export function createProgress(caseData?: CaseData): CaseProgress {
  return {
    ...(caseData?.v2 ? { v2: createV2Progress(caseData) } : {}),
    opened: [],
    chosenLink: [],
    calculations: {},
    article: [],
    published: false,
    revealed: false,
  };
}

export type GameAction =
  | V2Action
  | { type: 'open-document'; documentId: string }
  | { type: 'toggle-link'; documentId: string }
  | { type: 'set-calculation'; taskId: string; value: string }
  | { type: 'add-fragment'; fragmentId: string }
  | { type: 'remove-fragment'; index: number }
  | { type: 'replace-fragment'; index: number; fragmentId: string }
  | { type: 'move-fragment'; from: number; to: number }
  | { type: 'clear-article' }
  | { type: 'submit' }
  | { type: 'withdraw' }
  | { type: 'reveal' }
  | { type: 'reset' };

export function reduceProgress(
  caseData: CaseData,
  progress: CaseProgress,
  action: GameAction,
): CaseProgress {
  if (
    caseData.v2 &&
    [
      'toggle-link',
      'set-calculation',
      'add-fragment',
      'remove-fragment',
      'replace-fragment',
      'move-fragment',
      'clear-article',
    ].includes(action.type)
  )
    return progress;
  if (action.type.startsWith('v2-'))
    return reduceV2Progress(caseData, progress, action as V2Action);
  switch (action.type) {
    case 'open-document':
      return openDocument(caseData, progress, action.documentId);
    case 'toggle-link':
      return toggleLinkSelection(caseData, progress, action.documentId);
    case 'set-calculation':
      return setCalculation(progress, action.taskId, action.value);
    case 'add-fragment':
      return addFragment(progress, action.fragmentId);
    case 'remove-fragment':
      return removeFragmentAt(progress, action.index);
    case 'replace-fragment':
      return replaceFragmentAt(progress, action.index, action.fragmentId);
    case 'move-fragment':
      return moveFragment(progress, action.from, action.to);
    case 'clear-article':
      return clearArticle(progress);
    case 'submit':
      return submitArticle(progress);
    case 'withdraw':
      return withdrawArticle(progress);
    case 'reveal':
      return revealAnswer(progress);
    case 'reset':
      return createProgress(caseData);
  }
  return progress;
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
    ...(normalizeV2Progress(r.v2) ? { v2: normalizeV2Progress(r.v2) } : {}),
    opened: strArray(r.opened),
    chosenLink: strArray(r.chosenLink).slice(0, 2),
    calculations,
    article: strArray(r.article).slice(0, 3),
    published: r.published === true,
    revealed: r.revealed === true,
  };
}
