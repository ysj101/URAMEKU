import { caseStatus, continueCaseId, difficultyLevel } from './caseStatus';
import { makeCase, makeProgress } from '../test/fixtures';

describe('caseStatus', () => {
  it('進行状態を判定する', () => {
    expect(caseStatus('c', undefined, {})).toBe('new');
    expect(caseStatus('c', makeProgress(), {})).toBe('new');
    expect(caseStatus('c', makeProgress({ opened: ['a'] }), {})).toBe('investigating');
    expect(caseStatus('c', makeProgress({ article: ['f0'] }), {})).toBe('draft');
    expect(caseStatus('c', makeProgress({ published: true }), {})).toBe('published');
    expect(caseStatus('c', makeProgress({ published: true }), { c: true })).toBe('solved');
  });
  it('難易度の目盛り', () => {
    expect(difficultyLevel('NORMAL')).toBe(1);
    expect(difficultyLevel('HARD')).toBe(2);
    expect(difficultyLevel('EXPERT')).toBe(3);
  });
  it('続きの事件を選ぶ', () => {
    const cases = [
      makeCase({ id: 'case-01' }),
      makeCase({ id: 'case-02' }),
      makeCase({ id: 'case-03' }),
    ];
    expect(continueCaseId(cases, 'case-01', {}, {})).toBe('case-01');
    expect(continueCaseId(cases, 'case-01', {}, { 'case-01': true })).toBe('case-02');
    expect(
      continueCaseId(
        cases,
        'case-01',
        { 'case-03': makeProgress({ opened: ['a'] }) },
        { 'case-01': true },
      ),
    ).toBe('case-03');
    expect(
      continueCaseId(cases, 'case-01', {}, { 'case-01': true, 'case-02': true, 'case-03': true }),
    ).toBeUndefined();
  });
});
