import { useCallback, useEffect, useMemo, useState } from 'react';
import { CASES, findCase, nextCaseId } from '../data/cases';
import { createProgress, reduceProgress, type GameAction } from '../domain/game';
import { evaluateCase } from '../domain/scoring';
import type { CaseData, CaseProgress } from '../domain/types';
import { clearSaveData, loadSaveData, persistSaveData, type SaveData } from './persistence';

export type Stage = 'investigate' | 'article';

export interface GameApi {
  cases: CaseData[];
  current: CaseData;
  progress: CaseProgress;
  stage: Stage;
  finished: Record<string, boolean>;
  dispatch: (action: GameAction) => void;
  selectCase: (id: string) => void;
  setStage: (stage: Stage) => void;
  goToNextCase: () => void;
  resetAll: () => void;
}

const FIRST_CASE = CASES[0]?.id ?? 'case-01';

export function useGame(): GameApi {
  const [save, setSave] = useState<SaveData>(() => {
    const loaded = loadSaveData(FIRST_CASE);
    if (!findCase(loaded.active)) loaded.active = FIRST_CASE;
    return loaded;
  });
  const [stage, setStage] = useState<Stage>('investigate');

  useEffect(() => {
    persistSaveData(save);
  }, [save]);

  const current = useMemo(() => findCase(save.active) ?? CASES[0]!, [save.active]);
  const progress = save.progress[current.id] ?? createProgress();

  const dispatch = useCallback((action: GameAction) => {
    setSave((prev) => {
      const caseData = findCase(prev.active);
      if (!caseData) return prev;
      const before = prev.progress[caseData.id] ?? createProgress();
      const after = reduceProgress(caseData, before, action);
      if (after === before) return prev;
      const finished = { ...prev.finished };
      if (after.published && evaluateCase(caseData, after).cleared) finished[caseData.id] = true;
      return { ...prev, progress: { ...prev.progress, [caseData.id]: after }, finished };
    });
    if (action.type === 'reset') setStage('investigate');
  }, []);

  const selectCase = useCallback((id: string) => {
    if (!findCase(id)) return;
    setSave((prev) => (prev.active === id ? prev : { ...prev, active: id }));
    setStage('investigate');
  }, []);

  const goToNextCase = useCallback(() => {
    const next = nextCaseId(current.id);
    if (next) selectCase(next);
  }, [current.id, selectCase]);

  const resetAll = useCallback(() => {
    clearSaveData();
    setSave({ active: FIRST_CASE, progress: {}, finished: {} });
    setStage('investigate');
  }, []);

  return {
    cases: CASES,
    current,
    progress,
    stage,
    finished: save.finished,
    dispatch,
    selectCase,
    setStage,
    goToNextCase,
    resetAll,
  };
}
