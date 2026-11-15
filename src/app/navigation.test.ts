import { parseHash, toHash } from './navigation';

describe('navigation', () => {
  it('ハッシュを画面に変換する', () => {
    expect(parseHash('')).toEqual({ screen: 'home' });
    expect(parseHash('#/')).toEqual({ screen: 'home' });
    expect(parseHash('#/cases')).toEqual({ screen: 'cases' });
    expect(parseHash('#/play/case-05')).toEqual({ screen: 'play', caseId: 'case-05' });
    expect(parseHash('#/unknown')).toEqual({ screen: 'home' });
    expect(parseHash('#/settings?x=1')).toEqual({ screen: 'settings' });
  });
  it('画面をハッシュに変換する', () => {
    expect(toHash({ screen: 'home' })).toBe('#/');
    expect(toHash({ screen: 'cases' })).toBe('#/cases');
    expect(toHash({ screen: 'play', caseId: 'case-04' })).toBe('#/play/case-04');
    expect(toHash({ screen: 'play' })).toBe('#/play');
  });
});
