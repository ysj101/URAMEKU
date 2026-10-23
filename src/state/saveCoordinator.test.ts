import { compareSaves, nextRevision, resolveConflict } from './saveCoordinator';

const T0 = '2026-10-24T00:00:00.000Z';
const T1 = '2026-10-24T00:00:01.000Z';

describe('resolveConflict', () => {
  it('remote の revision が大きければ取り込む', () => {
    expect(resolveConflict({ revision: 3, savedAt: T1 }, { revision: 4, savedAt: T0 })).toBe(
      'take-remote',
    );
  });
  it('remote の revision が小さければ無視する（savedAt が新しくても）', () => {
    expect(resolveConflict({ revision: 5, savedAt: T0 }, { revision: 4, savedAt: T1 })).toBe(
      'keep-local',
    );
  });
  it('revision が同じなら savedAt で判定する', () => {
    expect(resolveConflict({ revision: 2, savedAt: T0 }, { revision: 2, savedAt: T1 })).toBe(
      'take-remote',
    );
    expect(resolveConflict({ revision: 2, savedAt: T1 }, { revision: 2, savedAt: T0 })).toBe(
      'keep-local',
    );
  });
  it('完全に同じなら自タブを保つ', () => {
    expect(resolveConflict({ revision: 2, savedAt: T0 }, { revision: 2, savedAt: T0 })).toBe(
      'keep-local',
    );
    expect(resolveConflict({ revision: 0 }, { revision: 0 })).toBe('keep-local');
  });
  it('savedAt が不正・欠落なら 0 とみなす', () => {
    expect(resolveConflict({ revision: 1, savedAt: 'garbage' }, { revision: 1, savedAt: T0 })).toBe(
      'take-remote',
    );
    expect(resolveConflict({ revision: 1, savedAt: T0 }, { revision: 1, savedAt: null })).toBe(
      'keep-local',
    );
  });
});

describe('compareSaves', () => {
  it('順序を返す', () => {
    expect(compareSaves({ revision: 1 }, { revision: 2 })).toBe('remote-newer');
    expect(compareSaves({ revision: 2 }, { revision: 1 })).toBe('local-newer');
    expect(compareSaves({ revision: 1, savedAt: T0 }, { revision: 1, savedAt: T0 })).toBe('same');
  });
});

describe('nextRevision', () => {
  it('単調に増える', () => {
    expect(nextRevision(0)).toBe(1);
    expect(nextRevision(41)).toBe(42);
  });
  it('不正値は 1 から始める', () => {
    expect(nextRevision(-1)).toBe(1);
    expect(nextRevision(Number.NaN)).toBe(1);
    expect(nextRevision(1.5)).toBe(1);
  });
});
