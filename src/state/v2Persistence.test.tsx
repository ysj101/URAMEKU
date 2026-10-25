import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useGame } from './useGame';
import {
  loadSaveDataDetailed,
  persistSaveData,
  createSaveData,
  STORAGE_KEY,
  type StorageLike,
} from './persistence';
import { createProgress, reduceProgress } from '../domain/game';
import { makeV2Case } from '../test/v2Fixtures';
import { restoreProgress } from './restoreProgress';
import { resetCaseProgress } from './wipe';

vi.mock('../data/cases', async () => {
  const { makeV2Case } = await import('../test/v2Fixtures');
  const c = makeV2Case(['decoding', 'experiment', 'decision']);
  return {
    CASES: [c],
    findCase: (id: string) => (id === c.id ? c : undefined),
    nextCaseId: () => undefined,
  };
});
const c = makeV2Case(['decoding', 'experiment', 'decision']);
function memory(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

it('archives every old version without awarding V2 completion', () => {
  for (const version of [0, 1, 2, 3]) {
    const s = memory();
    const payload = {
      ...(version > 1 ? { version } : {}),
      active: c.id,
      progress: { [c.id]: { ...createProgress(), opened: ['a'], published: true } },
      finished: { [c.id]: true },
      revision: 3,
    };
    s.setItem(version === 0 ? 'paper-backside-mvp-v1' : STORAGE_KEY, JSON.stringify(payload));
    const hook = renderHook(() => useGame({ storage: s }));
    expect(hook.result.current.progress.opened).toEqual([]);
    expect(hook.result.current.finished).toEqual({});
    expect(hook.result.current.legacyFinished?.[c.id]).toBe(true);
    expect(hook.result.current.migrationNotice).toContain('旧MVP');
    hook.unmount();
    expect(loadSaveDataDetailed(c.id, s).data.legacyProgress?.[c.id]?.opened).toEqual(['a']);
  }
});

it('resumes experiment condition and both decision records without rerolling', () => {
  const s = memory();
  const first = renderHook(() => useGame({ storage: s }));
  for (const documentId of ['a', 'b']) {
    act(() => first.result.current.dispatch({ type: 'open-document', documentId }));
    act(() => first.result.current.dispatch({ type: 'toggle-pin', documentId }));
  }
  act(() => first.result.current.dispatch({ type: 'v2-experiment-initial', choiceId: 'buy' }));
  const record = {
    objectiveId: 'cost',
    optionId: 'hold',
    reason: '条件を確認する',
    assumptions: '追加情報が必要',
    evidence: ['a'],
    counterEvidence: ['b'],
  };
  act(() => first.result.current.dispatch({ type: 'v2-decision', record }));
  first.unmount();
  const mid = renderHook(() => useGame({ storage: s }));
  expect(mid.result.current.progress.v2?.experiment?.initialChoice).toBe('buy');
  expect(mid.result.current.progress.v2?.decisions).toEqual([record]);
  act(() => mid.result.current.dispatch({ type: 'open-document', documentId: 'c' }));
  act(() => mid.result.current.dispatch({ type: 'toggle-pin', documentId: 'c' }));
  act(() =>
    mid.result.current.dispatch({
      type: 'v2-experiment-update',
      choiceId: 'wait',
      reason: '条件が異なる',
    }),
  );
  act(() =>
    mid.result.current.dispatch({
      type: 'v2-decision',
      record: { ...record, optionId: 'continue', evidence: ['a', 'c'] },
    }),
  );
  const expected = mid.result.current.progress;
  act(() => mid.result.current.setStage('article'));
  mid.unmount();
  const restored = renderHook(() => useGame({ storage: s }));
  expect(restored.result.current.progress).toEqual(expected);
  expect(restored.result.current.stage).toBe('article');
  expect(restored.result.current.progress.v2?.experiment?.conditionId).toBe(
    createProgress(c).v2?.experiment?.conditionId,
  );
  restored.unmount();
});

it('protects the exact unknown future payload even after local actions and flush', () => {
  const s = memory();
  const future = JSON.stringify({
    version: 99,
    active: c.id,
    opaque: { must: 'survive' },
    progress: {},
    finished: {},
  });
  s.setItem(STORAGE_KEY, future);
  const hook = renderHook(() => useGame({ storage: s }));
  expect(hook.result.current.saveStatus).toBe('read-only');
  act(() => hook.result.current.dispatch({ type: 'open-document', documentId: 'a' }));
  act(() => window.dispatchEvent(new Event('pagehide')));
  hook.unmount();
  expect(s.getItem(STORAGE_KEY)).toBe(future);
  expect(persistSaveData(createSaveData(c.id), s)).toBe(false); // race: stale writer is also blocked
  expect(s.getItem(STORAGE_KEY)).toBe(future);
});

it('archives only incompatible case revisions and never transfers completion', () => {
  const s = memory(),
    old = { ...createProgress(c), published: true };
  persistSaveData(
    {
      ...createSaveData(c.id),
      caseRevisions: { [c.id]: 99 },
      progress: { [c.id]: old },
      finished: { [c.id]: true },
    },
    s,
  );
  const hook = renderHook(() => useGame({ storage: s }));
  expect(hook.result.current.progress.published).toBe(false);
  expect(hook.result.current.finished[c.id]).toBeUndefined();
  expect(hook.result.current.migrationNotice).toContain('形式が変わった');
  hook.unmount();
});

it('normalizes bad phases, IDs and hidden documents when restoring the same revision', () => {
  const raw = {
    ...createProgress(c),
    opened: ['a', 'c', 'missing'],
    pinned: ['a', 'c', 'missing'],
  };
  raw.v2!.experiment!.initialChoice = 'invalid';
  const restored = restoreProgress(c, raw);
  expect(restored.opened).toEqual(['a']);
  expect(restored.v2?.experiment?.stage).toBe('initial');
  expect(restored.pinned).toEqual(['a']);
});

it('individual reset removes old and V2 histories only for that case', () => {
  const p = reduceProgress(c, createProgress(c), { type: 'open-document', documentId: 'a' });
  const save = {
    ...createSaveData(c.id),
    progress: { [c.id]: p, other: p },
    finished: { [c.id]: true, other: true },
    legacyProgress: { [c.id]: p, other: p },
    legacyFinished: { [c.id]: true, other: true },
    archivedProgress: { [`${c.id}@1`]: p, 'other@1': p },
    caseRevisions: { [c.id]: 1, other: 1 },
  };
  const reset = resetCaseProgress(save, c.id);
  expect(reset.progress).toEqual({ other: p });
  expect(reset.legacyProgress).toEqual({ other: p });
  expect(reset.legacyFinished).toEqual({ other: true });
  expect(reset.archivedProgress).toEqual({ 'other@1': p });
  expect(reset.caseRevisions).toEqual({ other: 1 });
});
