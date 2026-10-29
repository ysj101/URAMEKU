import { expect, it } from 'vitest';
import { CASES } from '../data/cases';
import { completeV2Case } from '../test/completeV2Case';
import { createSaveData } from './persistence';
import { sanitize } from './useGame';
import { evaluateV2Case } from '../domain/v2Evaluation';
import { remainingBudget } from '../domain/budget';

it('archives revision 1 and retains readings, spending and initial/updated judgments for the new board', () => {
  for (const data of CASES) {
    const old = completeV2Case(data);
    delete old.v2!.board;
    const loaded = {
      ...createSaveData(data.id),
      caseRevisions: { [data.id]: 1 },
      progress: { [data.id]: old },
      finished: { [data.id]: true },
    };
    const migrated = sanitize(loaded);
    const progress = migrated.progress[data.id]!;
    expect(migrated.archivedProgress?.[`${data.id}@1`]).toEqual(old);
    expect(progress.opened).toEqual(old.opened);
    expect(remainingBudget(data, progress)).toBe(remainingBudget(data, old));
    expect(progress.v2!.decoding).toEqual(old.v2!.decoding);
    expect(progress.v2!.decisions).toEqual(old.v2!.decisions);
    expect(progress.v2!.experiment).toEqual(old.v2!.experiment);
    expect(progress.v2!.report).toEqual(old.v2!.report);
    expect(progress.v2!.board).toEqual({});
    expect(progress.published).toBe(false);
    expect(migrated.finished[data.id]).toBeUndefined();
    expect(migrated.caseRevisions?.[data.id]).toBe(2);
    expect(evaluateV2Case(data, progress).completed).toBe(false);
    expect(sanitize(migrated)).toEqual(migrated);
  }
});
