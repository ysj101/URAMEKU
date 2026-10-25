import { V2_CONTENT_CASES } from '../test/v2ContentCases';
import { completeV2Case } from '../test/completeV2Case';
import { createProgress, reduceProgress } from '../domain/game';
import { evaluateCase } from '../domain/scoring';
import { LEGACY_CASES } from '../test/legacyCases';

const byId = (id: string) => V2_CONTENT_CASES.find((c) => c.id === id)!;

describe('V2 staged case content', () => {
  for (const c of V2_CONTENT_CASES) {
    describe(c.id, () => {
      it('uses authored sources and can complete through the main and alternative paths without arithmetic', () => {
        for (const options of [{}, { path: 1, alternative: true }]) {
          const p = completeV2Case(c, options);
          expect(p.calculations).toEqual({});
          expect(p.article).toEqual([]);
          expect(evaluateCase(c, p).cleared, JSON.stringify(p.v2)).toBe(true);
        }
      });
      it('requires more than reading the opening advertisement or guessing the V1 headline', () => {
        let p = createProgress(c);
        p = reduceProgress(c, p, { type: 'open-document', documentId: c.documents.find((d) => d.cost === 0)!.id });
        for (const f of c.correct_fragments) p = reduceProgress(c, p, { type: 'add-fragment', fragmentId: f });
        p = reduceProgress(c, p, { type: 'submit' });
        expect(evaluateCase(c, p).cleared).toBe(false);
      });
      if (c.v2?.experiment) {
        it('keeps purchase/support/hold reactions and judgement changes outside the factual verdict', () => {
          const e = c.v2!.experiment!;
          for (const choice of e.choices) {
            const p = completeV2Case(c, { experimentChoice: choice.id });
            expect(p.v2?.experiment?.initialChoice).toBe(choice.id);
            expect(p.v2?.experiment?.updatedChoice).toBe(choice.id);
            expect(evaluateCase(c, p).cleared).toBe(true);
          }
          const changed = completeV2Case(c, {
            experimentChoice: e.choices[0]!.id,
            experimentUpdatedChoice: e.choices.at(-1)!.id,
          });
          expect(changed.v2?.experiment?.initialChoice).toBe(e.choices[0]!.id);
          expect(changed.v2?.experiment?.updatedChoice).toBe(e.choices.at(-1)!.id);
          expect(evaluateCase(c, changed).cleared).toBe(true);
        });
        it('seals the case-specific reveal before the initial reaction and fixes the assigned condition', () => {
          const e = c.v2!.experiment!;
          let p = createProgress(c);
          for (const documentId of e.revealDocuments) {
            p = reduceProgress(c, p, { type: 'open-document', documentId });
            expect(p.opened).not.toContain(documentId);
          }
          const initialCondition = p.v2?.experiment?.conditionId;
          p = reduceProgress(c, p, { type: 'v2-experiment-initial', choiceId: e.choices[0]!.id });
          for (const documentId of e.revealDocuments) {
            p = reduceProgress(c, p, { type: 'open-document', documentId });
            expect(p.opened).toContain(documentId);
          }
          expect(p.v2?.experiment?.conditionId).toBe(initialCondition);
          expect(createProgress(c).v2?.experiment?.conditionId).toBe(initialCondition);
        });
      }
      it('keeps documentary facts and V1 answer keys while replacing the required arithmetic tasks', () => {
        const legacy = LEGACY_CASES.find((old) => old.id === c.id)!;
        expect(c.title).toBe(legacy.title);
        expect(c.required_evidence).toEqual(legacy.required_evidence);
        expect(c.required_link).toEqual(legacy.required_link);
        expect(c.correct_fragments).toEqual(legacy.correct_fragments);
        expect(c.documents.map((d) => d.id)).toEqual(legacy.documents.map((d) => d.id));
        expect(c.analysis_tasks).toEqual([]);
        for (const doc of c.documents) {
          const old = legacy.documents.find((d) => d.id === doc.id)!;
          expect(doc.content.startsWith(old.content)).toBe(true);
          expect(doc.cost).toBe(old.cost);
        }
      });
      it('requires multiple source readings and keeps uncertainty separate from a factual contradiction', () => {
        const v2 = c.v2!;
        const accepted = v2.decoding.flatMap((t) => t.options.filter((o) => o.accepted));
        expect(v2.decoding.length).toBeGreaterThanOrEqual(3);
        expect(accepted.some((o) => o.status === 'uncertain')).toBe(true);
        expect(new Set(accepted.flatMap((o) => o.evidence)).size).toBeGreaterThanOrEqual(3);
        expect(v2.graph.paths.length).toBeGreaterThanOrEqual(2);
        for (const path of v2.graph.paths) {
          expect(path.length).toBeGreaterThanOrEqual(2);
          expect(path.some((e) => e.relation === 'qualifies')).toBe(true);
        }
      });
    });
  }
  it('CASE02/03 framing conditions contain the same factual numbers, without changing data between conditions', () => {
    for (const id of ['case-02', 'case-03']) {
      const c = byId(id);
      const numbers = id === 'case-02' ? ['8,000', '4,000'] : ['200', '160', '80%'];
      for (const condition of c.v2!.experiment!.conditions) {
        for (const n of numbers) expect(condition.prompt).toContain(n);
      }
    }
  });
  it('CASE01 retains the 100→50→45 cohorts and explicitly supplies the comparative rate', () => {
    const c = byId('case-01');
    const body = (id: string) => c.documents.find((d) => d.id === id)!.content;
    expect(body('trial')).toContain('100人');
    expect(body('paid')).toContain('50人');
    expect(body('retained')).toContain('45人');
    expect(body('retained')).toContain('45%');
    expect(c.title).toContain(String(100 - 45));
  });
});
