import { countCorrectCalculations, isTaskCorrect, parseNumericInput } from './calculation';
import { makeCase, makeProgress } from '../test/fixtures';

const c = makeCase();
const [t1, t2] = c.analysis_tasks;

describe('calculation', () => {
  it('空欄・空白・NaN は null', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('   ')).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput(undefined)).toBeNull();
    expect(parseNumericInput('Infinity')).toBeNull();
  });
  it('許容誤差内なら正解', () => {
    expect(isTaskCorrect(t1!, '45')).toBe(true);
    expect(isTaskCorrect(t1!, '45.1')).toBe(true);
    expect(isTaskCorrect(t1!, '45.2')).toBe(false);
    expect(isTaskCorrect(t2!, '200')).toBe(true);
    expect(isTaskCorrect(t2!, '201')).toBe(false);
  });
  it('負値や空欄は不正解として数える', () => {
    const p = makeProgress({ calculations: { t1: '-45', t2: '' } });
    expect(countCorrectCalculations(c, p)).toBe(0);
  });
});
