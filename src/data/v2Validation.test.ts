import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateCase } from './validateCase';
import { makeV2Case } from '../test/v2Fixtures';
import { makeCase } from '../test/fixtures';

function cliErrors(data: unknown): string[] {
  const source = `import { validateCaseJson } from './scripts/validate_cases.mjs';\nconst schema = ${readFileSync('data/schema/case.schema.json', 'utf8')};\nconsole.log(JSON.stringify(validateCaseJson(schema, ${JSON.stringify(data)})));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' }));
}

describe('V2 data contract', () => {
  it('accepts old data and all three modes without calculations in browser and CLI', () => {
    for (const c of [makeCase(), makeV2Case(), makeV2Case(['experiment']), makeV2Case(['decision']), makeV2Case(['decoding','experiment','decision'])]) {
      expect(validateCase(c).errors).toEqual([]);
      expect(cliErrors(c)).toEqual([]);
    }
  });
  it('rejects unknown versions/modes, missing mode config and invalid references', () => {
    const base = makeV2Case(['experiment']);
    const samples: unknown[] = [
      { ...base, schemaVersion: 3 },
      { ...base, v2: { ...base.v2, modes: ['unknown'] } },
      { ...base, v2: { ...base.v2, experiment: undefined } },
      { ...base, v2: { ...base.v2, graph: { prompt: '問い', paths: [[{from:'a',to:'missing',relation:'qualifies'}]] } } },
      { ...base, v2: { ...base.v2, graph: { prompt: '問い', paths: [[{from:'a',to:'a',relation:'sequence'}]] } } },
      { ...base, budget: 1 },
      { ...base, v2: { ...base.v2, experiment: { ...base.v2!.experiment!, choices: [{id:'buy',text:'買う'},{id:'buy',text:'待つ'}] } } },
    ];
    for (const c of samples) {
      expect(validateCase(c).ok).toBe(false);
      expect(cliErrors(c).length).toBeGreaterThan(0);
    }
  });
  it('does not mutate factual data or old answer keys while validating', () => {
    const c = makeV2Case(); const before = JSON.stringify(c);
    validateCase(c); cliErrors(c);
    expect(JSON.stringify(c)).toBe(before);
  });
});


it('keeps V2 graph questions role-based instead of revealing a source title', () => {
  const data = makeV2Case();
  data.v2!.graph.prompt = `根拠となる${data.documents[1]!.title}を選んでください。`;
  expect(validateCase(data).errors.some((error) => error.startsWith('v2.graph.prompt:'))).toBe(true);
  expect(cliErrors(data).some((error) => error.startsWith('v2.graph.prompt:'))).toBe(true);
});

it('validates claim-board quotes, fields and alternative rules in both browser and CLI', async () => {
  const { V2_CONTENT_CASES } = await import('../test/v2ContentCases');
  const base = V2_CONTENT_CASES[0]!;
  expect(validateCase(base).errors).toEqual([]);
  expect(cliErrors(base)).toEqual([]);
  const mutations: ((c: typeof base) => void)[] = [
    (c) => { c.v2!.board!.excerpts[0]!.quote = '資料に存在しない引用'; },
    (c) => { c.v2!.board!.tasks[0]!.rules[0]!.evidence = ['unknown']; },
    (c) => { c.v2!.board!.tasks[0]!.rules[0]!.values.subject = 'unknown'; },
    (c) => { c.v2!.board!.tasks[0]!.parts.push({ field: 'subject' }); },
    (c) => { c.v2!.board!.tasks[0]!.rules[0]!.disposition = 'keep'; },
    (c) => { c.v2!.board!.tasks[0]!.fields[0]!.original = 'unknown'; },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(base);
    mutate(copy);
    expect(validateCase(copy).ok).toBe(false);
    expect(cliErrors(copy).length).toBeGreaterThan(0);
  }
});
