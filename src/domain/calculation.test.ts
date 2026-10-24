import {
  countCorrectCalculations,
  interpretInput,
  isTaskCorrect,
  isWithinTolerance,
  parseNumericInput,
} from './calculation';
import { makeCase, makeProgress } from '../test/fixtures';
import { CASES } from '../data/cases';
import type { AnalysisTask } from './types';

const c = makeCase();
const [t1, t2] = c.analysis_tasks;
const pct: AnalysisTask = { id: 'p', prompt: 'p', unit: '%', expected: 45, tolerance: 0.1 };
const man: AnalysisTask = { id: 'm', prompt: 'm', unit: '万円', expected: 150, tolerance: 0 };

describe('parseNumericInput: 空欄・NaN', () => {
  it('空欄・空白のみ・undefined/null は null', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('   ')).toBeNull();
    expect(parseNumericInput('　　')).toBeNull();
    expect(parseNumericInput(undefined)).toBeNull();
    expect(parseNumericInput(null)).toBeNull();
  });
  it('NaN / Infinity / 文字混じり / 符号のみ は null', () => {
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('NaN')).toBeNull();
    expect(parseNumericInput('Infinity')).toBeNull();
    expect(parseNumericInput('-Infinity')).toBeNull();
    expect(parseNumericInput('4５a')).toBeNull();
    expect(parseNumericInput('-')).toBeNull();
    expect(parseNumericInput('+')).toBeNull();
    expect(parseNumericInput('.')).toBeNull();
    expect(parseNumericInput('4 5')).toBeNull();
    expect(parseNumericInput('0x10')).toBeNull();
  });
  it('複数の小数点は null', () => {
    expect(parseNumericInput('4.5.1')).toBeNull();
    expect(parseNumericInput('４．５．１')).toBeNull();
  });
  it('指数表記は拒否する', () => {
    expect(parseNumericInput('1e3')).toBeNull();
    expect(parseNumericInput('1E3')).toBeNull();
    expect(parseNumericInput('4.5e1')).toBeNull();
  });
});

describe('parseNumericInput: 正規化', () => {
  it('前後の空白（半角・全角）を無視する', () => {
    expect(parseNumericInput('  45  ')).toBe(45);
    expect(parseNumericInput('　45　')).toBe(45);
    expect(parseNumericInput('\t45\n')).toBe(45);
  });
  it('全角数字・全角記号を解釈する', () => {
    expect(parseNumericInput('１２３．５')).toBe(123.5);
    expect(parseNumericInput('－５')).toBe(-5);
    expect(parseNumericInput('−５')).toBe(-5);
    expect(parseNumericInput('＋５')).toBe(5);
    expect(parseNumericInput('１，２００')).toBe(1200);
  });
  it('桁区切りカンマを除去する', () => {
    expect(parseNumericInput('1,200')).toBe(1200);
    expect(parseNumericInput('1,200,000')).toBe(1200000);
    expect(parseNumericInput('1,200.5')).toBe(1200.5);
  });
  it('+ 符号・先頭ゼロ・末尾/先頭の小数点を許容する', () => {
    expect(parseNumericInput('+45')).toBe(45);
    expect(parseNumericInput('045')).toBe(45);
    expect(parseNumericInput('00.5')).toBe(0.5);
    expect(parseNumericInput('45.')).toBe(45);
    expect(parseNumericInput('.5')).toBe(0.5);
  });
  it('末尾の % を除去する（タスク未指定でも）', () => {
    expect(parseNumericInput('45%')).toBe(45);
    expect(parseNumericInput('45 %')).toBe(45);
    expect(parseNumericInput('４５％')).toBe(45);
  });
  it('タスクの単位文字列を末尾から除去する', () => {
    expect(parseNumericInput('45%', pct)).toBe(45);
    expect(parseNumericInput('150万円', man)).toBe(150);
    expect(parseNumericInput('150 万円', man)).toBe(150);
    expect(parseNumericInput('200円', { unit: '円' })).toBe(200);
    expect(parseNumericInput('10ポイント', { unit: 'ポイント' })).toBe(10);
    expect(parseNumericInput('1,500,000円', { unit: '円' })).toBe(1500000);
  });
  it('単位だけ・別の単位・途中の単位は null', () => {
    expect(parseNumericInput('万円', man)).toBeNull();
    expect(parseNumericInput('%', pct)).toBeNull();
    expect(parseNumericInput('150万', man)).toBeNull();
    expect(parseNumericInput('150円', man)).toBeNull();
    expect(parseNumericInput('万円150', man)).toBeNull();
  });
  it('-0 は 0 として扱う', () => {
    expect(Object.is(parseNumericInput('-0'), 0)).toBe(true);
  });
  it('数値型の入力も受け付ける（保存データ互換）', () => {
    expect(parseNumericInput(45)).toBe(45);
  });
});

describe('interpretInput', () => {
  it('空欄は issue: empty', () => {
    expect(interpretInput('')).toEqual({ value: null, normalized: '', issue: 'empty' });
    expect(interpretInput('  ')).toEqual({ value: null, normalized: '', issue: 'empty' });
    expect(interpretInput(undefined)).toEqual({ value: null, normalized: '', issue: 'empty' });
  });
  it('解釈不能は issue: not-a-number', () => {
    expect(interpretInput('abc')).toMatchObject({ value: null, issue: 'not-a-number' });
    expect(interpretInput('1e3')).toMatchObject({ value: null, issue: 'not-a-number' });
    expect(interpretInput('4.5.1')).toMatchObject({ value: null, issue: 'not-a-number' });
    expect(interpretInput('NaN')).toMatchObject({ value: null, issue: 'not-a-number' });
  });
  it('負値は値を返しつつ issue: negative（解釈不能ではない）', () => {
    expect(interpretInput('-45')).toEqual({ value: -45, normalized: '-45', issue: 'negative' });
    expect(interpretInput('－４５％', pct)).toEqual({
      value: -45,
      normalized: '-45',
      issue: 'negative',
    });
  });
  it('正常値は issue なし、normalized は半角・単位なし', () => {
    expect(interpretInput('　１，２００円 ', { unit: '円' })).toEqual({
      value: 1200,
      normalized: '1200',
    });
    expect(interpretInput('45%', pct)).toEqual({ value: 45, normalized: '45' });
    expect(interpretInput('+045.')).toEqual({ value: 45, normalized: '+045.' });
  });
});

describe('許容誤差', () => {
  it('tolerance 0.1: 境界を含む', () => {
    expect(isTaskCorrect(t1!, '45')).toBe(true);
    expect(isTaskCorrect(t1!, '45.1')).toBe(true);
    expect(isTaskCorrect(t1!, '44.9')).toBe(true);
    expect(isTaskCorrect(t1!, '44.95')).toBe(true);
    expect(isTaskCorrect(t1!, '45.05')).toBe(true);
    expect(isTaskCorrect(t1!, '44.89')).toBe(false);
    expect(isTaskCorrect(t1!, '45.11')).toBe(false);
    expect(isTaskCorrect(t1!, '45.2')).toBe(false);
  });
  it('tolerance 0: 完全一致', () => {
    expect(isTaskCorrect(t2!, '200')).toBe(true);
    expect(isTaskCorrect(t2!, '200.0')).toBe(true);
    expect(isTaskCorrect(t2!, '２００')).toBe(true);
    expect(isTaskCorrect(t2!, '200円')).toBe(true);
    expect(isTaskCorrect(t2!, '201')).toBe(false);
    expect(isTaskCorrect(t2!, '199.99')).toBe(false);
    expect(isTaskCorrect(t2!, '200.01')).toBe(false);
    expect(isTaskCorrect(t2!, '200.001')).toBe(false);
  });
  it('tolerance 0 でも浮動小数の丸め誤差（1e-9）は吸収する', () => {
    const t: AnalysisTask = { id: 'f', prompt: 'f', unit: '', expected: 0.3, tolerance: 0 };
    expect(isWithinTolerance(0.1 + 0.2, t)).toBe(true);
    expect(isWithinTolerance(0.3 + 1e-8, t)).toBe(false);
  });
  it('負値・空欄・解釈不能は不正解', () => {
    expect(isTaskCorrect(t1!, '-45')).toBe(false);
    expect(isTaskCorrect(t1!, '')).toBe(false);
    expect(isTaskCorrect(t1!, undefined)).toBe(false);
    expect(isTaskCorrect(t1!, 'abc')).toBe(false);
    expect(isTaskCorrect(t1!, '1e3')).toBe(false);
  });
  it('countCorrectCalculations は互換（負値・空欄は 0 件）', () => {
    const p = makeProgress({ calculations: { t1: '-45', t2: '' } });
    expect(countCorrectCalculations(c, p)).toBe(0);
    const ok = makeProgress({ calculations: { t1: '４５％', t2: '200円' } });
    expect(countCorrectCalculations(c, ok)).toBe(2);
    const partial = makeProgress({ calculations: { t1: '44.89' } });
    expect(countCorrectCalculations(c, partial)).toBe(0);
  });
});

describe('実データ 5 件 × 2 問', () => {
  /** 境界値を小数1桁に丸めて文字列化（0.1+0.2 のような表記揺れを避ける） */
  const fmt = (n: number) => n.toFixed(2).replace(/0$/, '');

  it('5 件すべてに 2 問ある', () => {
    expect(CASES).toHaveLength(5);
    for (const cs of CASES) expect(cs.analysis_tasks).toHaveLength(2);
  });

  for (const cs of CASES) {
    for (const task of cs.analysis_tasks) {
      describe(`${cs.id} / ${task.id} (expected ${task.expected}${task.unit}, ±${task.tolerance})`, () => {
        it('期待値そのものは正解', () => {
          expect(isTaskCorrect(task, String(task.expected))).toBe(true);
          expect(isTaskCorrect(task, `${task.expected}${task.unit}`)).toBe(true);
          expect(isTaskCorrect(task, ` ${task.expected} `)).toBe(true);
        });
        it('境界値（expected ± tolerance）は正解', () => {
          expect(isTaskCorrect(task, fmt(task.expected + task.tolerance))).toBe(true);
          expect(isTaskCorrect(task, fmt(task.expected - task.tolerance))).toBe(true);
        });
        it('境界外（expected ± (tolerance + 0.01)）は不正解', () => {
          expect(isTaskCorrect(task, fmt(task.expected + task.tolerance + 0.01))).toBe(false);
          expect(isTaskCorrect(task, fmt(task.expected - task.tolerance - 0.01))).toBe(false);
        });
        it('負値・空欄は不正解', () => {
          expect(isTaskCorrect(task, `-${task.expected}`)).toBe(false);
          expect(isTaskCorrect(task, '')).toBe(false);
        });
      });
    }
  }

  it('case-02 relative: 4.76 を入れても tolerance 0.1 で正解、4.69 は不正解', () => {
    const task = CASES.find((x) => x.id === 'case-02')!.analysis_tasks.find(
      (t) => t.id === 'relative',
    )!;
    expect(task.expected).toBe(4.8);
    expect(isTaskCorrect(task, '4.76')).toBe(true);
    expect(isTaskCorrect(task, '4.8')).toBe(true);
    expect(isTaskCorrect(task, '4.7')).toBe(true);
    expect(isTaskCorrect(task, '4.9')).toBe(true);
    expect(isTaskCorrect(task, '4.69')).toBe(false);
    expect(isTaskCorrect(task, '4.91')).toBe(false);
    expect(isTaskCorrect(task, '5')).toBe(false);
  });

  it('case-02 diff: tolerance 0 なので 200 ちょうどのみ', () => {
    const task = CASES.find((x) => x.id === 'case-02')!.analysis_tasks.find(
      (t) => t.id === 'diff',
    )!;
    expect(isTaskCorrect(task, '200')).toBe(true);
    expect(isTaskCorrect(task, '200円')).toBe(true);
    expect(isTaskCorrect(task, '-200')).toBe(false);
    expect(isTaskCorrect(task, '199')).toBe(false);
  });

  it('case-04: 万円単位。円で答えると不正解', () => {
    const cs = CASES.find((x) => x.id === 'case-04')!;
    const [cont, alt] = cs.analysis_tasks;
    expect(isTaskCorrect(cont!, '150万円')).toBe(true);
    expect(isTaskCorrect(cont!, '1,500,000')).toBe(false);
    expect(isTaskCorrect(alt!, '80')).toBe(true);
    expect(isTaskCorrect(alt!, '80.5')).toBe(false);
  });

  it('case-05: 絶対差は完全一致、相対増加率は ±0.1', () => {
    const cs = CASES.find((x) => x.id === 'case-05')!;
    const [abs, rel] = cs.analysis_tasks;
    expect(isTaskCorrect(abs!, '10ポイント')).toBe(true);
    expect(isTaskCorrect(abs!, '10%')).toBe(true);
    expect(isTaskCorrect(abs!, '25')).toBe(false);
    expect(isTaskCorrect(rel!, '25')).toBe(true);
    expect(isTaskCorrect(rel!, '25.1')).toBe(true);
    expect(isTaskCorrect(rel!, '10')).toBe(false);
  });
});
