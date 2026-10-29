import { describe, expect, it } from 'vitest';
import { V2_CONTENT_CASES } from '../test/v2ContentCases';
import { completeV2Case } from '../test/completeV2Case';
import { boardReviews, boardStatement } from './board';
import { evaluateV2Case } from './v2Evaluation';
import { normalizeProgress, reduceProgress } from './game';
import { restoreProgress } from '../state/restoreProgress';
import { v2RequiredDocumentSets } from './v2Requirements';

for (const data of V2_CONTENT_CASES)
  describe(`${data.id} claim evidence`, () => {
    it('accepts all authored alternatives, with exact documentary quotes and read sources', () => {
      for (const alternative of [false, true]) {
        const progress = completeV2Case(data, { alternative });
        expect(evaluateV2Case(data, progress).completed).toBe(true);
        expect(boardReviews(data, progress).every((review) => review.accepted)).toBe(true);
        for (const excerpt of data.v2!.board!.excerpts) {
          expect(data.documents.find((doc) => doc.id === excerpt.documentId)!.content).toContain(
            excerpt.quote,
          );
        }
        expect(normalizeProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress);
        expect(restoreProgress(data, progress).v2!.board).toEqual(progress.v2!.board);
      }
      expect(
        v2RequiredDocumentSets(data).some(
          (ids) =>
            ids.reduce((cost, id) => cost + data.documents.find((doc) => doc.id === id)!.cost, 0) <=
            data.budget,
        ),
      ).toBe(true);
    });
    it('does not substitute old edges or a correct sentence without evidence for a complete board', () => {
      const progress = completeV2Case(data);
      progress.v2!.board = {};
      expect(evaluateV2Case(data, progress).completed).toBe(false);
      expect(progress.v2!.links.length).toBeGreaterThan(0);
      const task = data.v2!.board!.tasks[0]!;
      const rule = task.rules[0]!;
      const editable = { ...progress, published: false };
      expect(
        reduceProgress(data, editable, {
          type: 'v2-board',
          taskId: task.id,
          record: { ...rule, evidence: [] },
        }),
      ).toBe(editable);
    });
    it('retains mistakes for review but rejects unknown fields, unknown or unread excerpts and published edits', () => {
      const progress = completeV2Case(data);
      const board = data.v2!.board!;
      const task = board.tasks[0]!;
      const record = progress.v2!.board![task.id]!;
      const field = task.fields[0]!;
      const wrong = {
        ...record,
        values: {
          ...record.values,
          [field.id]: field.options.find((option) => option.id !== record.values[field.id])!.id,
        },
      };
      expect(
        reduceProgress(data, progress, { type: 'v2-board', taskId: task.id, record: wrong }),
      ).toBe(progress);
      const editable = { ...progress, published: false };
      const changed = reduceProgress(data, editable, {
        type: 'v2-board',
        taskId: task.id,
        record: wrong,
      });
      expect(changed.v2!.board![task.id]).toEqual(wrong);
      expect(evaluateV2Case(data, changed).completed).toBe(false);
      expect(
        evaluateV2Case(data, changed).factualErrors.some(
          (error) => error.taskId === `board:${task.id}`,
        ),
      ).toBe(true);
      for (const invalid of [
        { ...record, evidence: ['unknown'] },
        { ...record, evidence: [...record.evidence, record.evidence[0]!] },
        { ...record, values: { ...record.values, unknown: field.original } },
        { ...record, values: { ...record.values, [field.id]: 'unknown' } },
      ])
        expect(
          reduceProgress(data, editable, { type: 'v2-board', taskId: task.id, record: invalid }),
        ).toBe(editable);
      const source = board.excerpts.find((entry) => entry.id === record.evidence[0])!.documentId;
      const unread = { ...editable, opened: editable.opened.filter((id) => id !== source) };
      expect(reduceProgress(data, unread, { type: 'v2-board', taskId: task.id, record })).toBe(
        unread,
      );
      expect(restoreProgress(data, unread).v2!.board![task.id]).toBeUndefined();
    });
    it('allows evidence in either order but rejects irrelevant extra evidence and a wrong disposition', () => {
      const progress = completeV2Case(data);
      const task = data.v2!.board!.tasks[0]!;
      const record = progress.v2!.board![task.id]!;
      record.evidence.reverse();
      expect(boardReviews(data, progress)[0]!.accepted).toBe(true);
      record.disposition = record.disposition === 'keep' ? 'revise' : 'keep';
      expect(boardReviews(data, progress)[0]!.accepted).toBe(false);
      record.disposition = task.rules[0]!.disposition;
      const allowed = new Set(task.rules.flatMap((rule) => rule.evidence));
      record.evidence = [...allowed];
      progress.opened = [
        ...new Set([
          ...progress.opened,
          ...data
            .v2!.board!.excerpts.filter((entry) => allowed.has(entry.id))
            .map((entry) => entry.documentId),
        ]),
      ];
      expect(boardReviews(data, progress)[0]!.accepted).toBe(true);
      const extra = data.v2!.board!.excerpts.find(
        (entry) => !allowed.has(entry.id) && progress.opened.includes(entry.documentId),
      )!;
      record.evidence.push(extra.id);
      expect(boardReviews(data, progress)[0]!.accepted).toBe(false);
      expect(boardStatement(task, record.values)).not.toContain('undefined');
    });
  });
