import { CASES, findCase, nextCaseId } from './cases';
import { evaluateCase } from '../domain/scoring';
import { createProgress, reduceProgress } from '../domain/game';

describe('実データ（data/cases）', () => {
  it('5件が読み込める', () => {
    expect(CASES.map((c) => c.id)).toEqual(['case-01', 'case-02', 'case-03', 'case-04', 'case-05']);
  });
  it('各事件は定義どおりの操作でクリアできる', () => {
    for (const c of CASES) {
      let p = createProgress();
      for (const id of c.required_evidence) {
        p = reduceProgress(c, p, { type: 'open-document', documentId: id });
        p = reduceProgress(c, p, { type: 'toggle-pin', documentId: id });
      }
      for (const id of c.required_link) {
        p = reduceProgress(c, p, { type: 'open-document', documentId: id });
        if (!p.pinned.includes(id)) p = reduceProgress(c, p, { type: 'toggle-pin', documentId: id });
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
  it('次の事件へ循環する', () => {
    expect(nextCaseId('case-05')).toBe('case-01');
    expect(findCase('case-03')?.title).toBeTruthy();
  });
});
