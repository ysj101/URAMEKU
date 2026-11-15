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
      makeCase({ id: 'case-03' }),
      makeCase({ id: 'case-04' }),
      makeCase({ id: 'case-05' }),
    ];
    expect(continueCaseId(cases, 'case-03', {}, {})).toBe('case-03');
    expect(continueCaseId(cases, 'case-03', {}, { 'case-03': true })).toBe('case-04');
    expect(
      continueCaseId(
        cases,
        'case-03',
        { 'case-05': makeProgress({ opened: ['a'] }) },
        { 'case-03': true },
      ),
    ).toBe('case-05');
    expect(
      continueCaseId(cases, 'case-03', {}, { 'case-03': true, 'case-04': true, 'case-05': true }),
    ).toBeUndefined();
  });
});
