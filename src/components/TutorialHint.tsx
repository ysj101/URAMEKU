import { UI } from '../data/ui';
import { hintFor } from './hintSelector';
import { useTutorialState } from '../state/tutorialState';
import type { StorageLike } from '../state/persistence';
import type { Stage } from '../state/migrations';
import type { CaseData, CaseProgress } from '../domain/types';
import '../app/screens/tutorial.css';

export interface TutorialHintProps {
  caseData: CaseData;
  progress: CaseProgress;
  stage: Stage;
  /** テスト用の保存先差し替え。省略時は localStorage */
  storage?: StorageLike | null;
}

/**
 * プレイ画面の段階ヒント（MVP-021）。「ヒントを閉じる」で以後は出さない（設定画面の
 * 「はじめてのヒントを表示する」で戻せる）。閉じた後どうなるかは見える文字で示す。
 * 組み込みは PlayScreen の CaseHeader 直後。
 */
export function TutorialHint({ caseData, progress, stage, storage }: TutorialHintProps) {
  const { state, disableHints } = useTutorialState(storage);
  const key = hintFor(caseData, progress, stage);
  if (!state.hintsEnabled || key === null) return null;
  return (
    <div className="tutorial-hint" role="status">
      <span className="tutorial-hint-label">{UI.tutorial.hint.label}</span>
      <p className="tutorial-hint-text">{UI.tutorial.hint[key]}</p>
      <button type="button" className="btn ghost" onClick={disableHints}>
        {UI.tutorial.hint.dismiss}
      </button>
      <p className="tutorial-hint-note fine">{UI.tutorial.hint.dismissNote}</p>
    </div>
  );
}
