import { CASES, findCase, nextCaseId } from './cases';
import { evaluateCase } from '../domain/scoring';
import { createProgress, reduceProgress } from '../domain/game';
import { LEGACY_CASES } from '../test/legacyCases';
import { completeV2Case } from '../test/completeV2Case';

describe('実データ（data/cases）', () => {
  it('5件が読み込める', () => {
    expect(CASES.map((c) => c.id)).toEqual(['case-01', 'case-02', 'case-03', 'case-04', 'case-05']);
  });
  it('旧V1ケースは保存した不変の解法で引き続き検証できる', () => {
    for (const c of LEGACY_CASES) {
      let p = createProgress();
      for (const id of c.required_evidence) {
        p = reduceProgress(c, p, { type: 'open-document', documentId: id });
      }
      for (const id of c.required_link) {
        p = reduceProgress(c, p, { type: 'open-document', documentId: id });
        p = reduceProgress(c, p, { type: 'toggle-link', documentId: id });
      }
      for (const t of c.analysis_tasks) {
        p = reduceProgress(c, p, { type: 'set-calculation', taskId: t.id, value: String(t.expected) });
      }
      for (const f of c.correct_fragments) p = reduceProgress(c, p, { type: 'add-fragment', fragmentId: f });
      p = reduceProgress(c, p, { type: 'submit' });
      const r = evaluateCase(c, p);
      expect(r.cleared, `${c.id} がクリアできない`).toBe(true);
    }
  });
  it('本番ローダーは全5件をV2として読み、計算入力なしで主経路と別経路を完了できる', () => {
    for (const c of CASES) {
      expect(c.schemaVersion).toBe(2);
      expect(c.v2).toBeDefined();
      expect(c.analysis_tasks).toEqual([]);
      for (const options of [{}, { path: 1, alternative: true }]) {
        const p = completeV2Case(c, options);
        expect(p.calculations).toEqual({});
        expect(p.article).toEqual([]);
        expect(evaluateCase(c, p).cleared, `${c.id} V2経路${options.path ?? 0}`).toBe(true);
      }
    }
  });
  it('V2は旧見出しだけ当てても完了しない', () => {
    for (const c of CASES) {
      let p = createProgress(c);
      for (const f of c.correct_fragments) p = reduceProgress(c, p, { type: 'add-fragment', fragmentId: f });
      p = reduceProgress(c, p, { type: 'submit' });
      expect(evaluateCase(c, p).cleared).toBe(false);
    }
  });
  it('次の事件へ循環する' , () => {
    expect(nextCaseId('case-05')).toBe('case-01');
    expect(findCase('case-03')?.title).toBeTruthy();
  });
});
