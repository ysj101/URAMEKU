import { describe, expect, it } from 'vitest';
import { v2GraphComplete, v2GraphProgress } from './link';
import { reduceProgress } from './game';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';

const data = makeV2Case();

describe('role-labelled evidence routes', () => {
  it('accepts either authored route while respecting direction and role', () => {
    const progress = makeV2Progress();
    progress.v2!.links = [{ from: 'a', to: 'b', relation: 'qualifies' }];
    expect(v2GraphComplete(data, progress)).toBe(true);
    progress.v2!.links = [{ from: 'a', to: 'c', relation: 'contradicts' }];
    expect(v2GraphComplete(data, progress)).toBe(true);
    progress.v2!.links = [{ from: 'c', to: 'a', relation: 'contradicts' }];
    expect(v2GraphComplete(data, progress)).toBe(false);
    progress.v2!.links = [{ from: 'a', to: 'b', relation: 'supports' }];
    expect(v2GraphProgress(data, progress)).toEqual({ done: 0, total: 1 });
  });
  it('requires read and existing sources', () => {
    let progress = makeV2Progress();
    progress = reduceProgress(data, progress, {
      type: 'v2-link',
      link: { from: 'a', to: 'b', relation: 'qualifies' },
    });
    expect(v2GraphComplete(data, progress)).toBe(true);
    expect(v2GraphComplete(data, { ...progress, opened: ['a'] })).toBe(false);
  });
  it('toggles an exact edge without allowing self-reference, duplication or unknown sources', () => {
    let progress = makeV2Progress();
    const link = { from: 'a', to: 'b', relation: 'qualifies' as const };
    progress = reduceProgress(data, progress, { type: 'v2-link', link });
    expect(progress.v2!.links).toHaveLength(1);
    progress = reduceProgress(data, progress, { type: 'v2-link', link });
    expect(progress.v2!.links).toHaveLength(0);
    expect(reduceProgress(data, progress, { type: 'v2-link', link: { ...link, to: 'a' } })).toBe(
      progress,
    );
    expect(reduceProgress(data, progress, { type: 'v2-link', link: { ...link, to: 'fake' } })).toBe(
      progress,
    );
  });
});

it('keeps decoding editable while preserving historical decisions', () => {
  const data = makeV2Case();
  let progress = makeV2Progress();
  progress.v2!.decoding.scope = {
    optionId: 'limited',
    evidence: ['a', 'b'],
    note: '対象範囲の記録',
  };
  const historical = {
    objectiveId: 'safety',
    optionId: 'hold',
    reason: '当時の理由',
    assumptions: '当時の前提',
    evidence: ['a'],
    counterEvidence: ['b'],
  };
  progress.v2!.decisions = [historical];
  progress = reduceProgress(data, progress, {
    type: 'v2-decode',
    taskId: 'scope',
    optionId: 'open',
    evidence: ['b'],
  });
  expect(progress.v2!.decoding.scope!.optionId).toBe('open');
});
