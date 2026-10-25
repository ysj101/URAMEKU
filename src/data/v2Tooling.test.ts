import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { makeCase } from '../test/fixtures';
import { makeV2Case } from '../test/v2Fixtures';

function tooling(c: unknown) {
  const source=`import {analyzeCase,requiredDocumentPaths} from './scripts/analyze_dead_ends.mjs';import {renderGenerated} from './scripts/generate_walkthrough.mjs';const c=${JSON.stringify(c)};console.log(JSON.stringify({paths:requiredDocumentPaths(c),analysis:analyzeCase(c),walkthrough:renderGenerated(c)}));`;
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8'})) as {
    paths:string[][];analysis:{neededCost:number;completableFromStart:boolean;deadEndSubsets:number;analysisScope:string};walkthrough:string;
  };
}

it('analyzes alternative evidence paths instead of requiring their union',()=>{
  const c=makeV2Case();
  c.budget=2;
  c.v2!.decoding[0]!.options[0]!.evidence=['a'];
  c.v2!.decoding[0]!.options.push({...c.v2!.decoding[0]!.options[0]!,id:'alternate',evidence:['b']});
  c.v2!.graph.paths.push([{from:'a',to:'c',relation:'qualifies'}]);
  const result=tooling(c);
  expect(result.paths).toEqual([['a','b'],['a','c']]);
  expect(result.analysis.neededCost).toBe(2);
  expect(result.analysis.completableFromStart).toBe(true);
  expect(result.analysis.analysisScope).toContain('budget-only');
  expect(result.walkthrough).toContain('代替経路');
  expect(result.walkthrough).toContain('解読・グラフ・開示');
  c.budget=1;
  expect(tooling(c).analysis.completableFromStart).toBe(false);
});

it('includes reveal documents and describes all V2 phases without legacy scoring',()=>{
  const result=tooling(makeV2Case(['decoding','experiment','decision']));
  expect(result.paths).toEqual([['a','b','c']]);
  expect(result.walkthrough).toContain('心理実験: 初回 → 比較 → 更新');
  expect(result.walkthrough).toContain('意思決定: 目的・制約・別方針');
  expect(result.walkthrough).toContain('主張と未確認事項');
  expect(result.walkthrough).not.toContain('### コストとスコア');
  expect(result.walkthrough).not.toContain('### 検証メモ（数値入力）');
  expect(result.walkthrough).not.toContain('/ 100');
});

it('keeps the legacy calculation walkthrough for archived-format fixtures',()=>{
  const result=tooling(makeCase());
  expect(result.analysis.neededCost).toBe(3);
  expect(result.walkthrough).toContain('### 検証メモ（数値入力）');
  expect(result.walkthrough).toContain('### コストとスコア');
});

it('deduplicates intermediate paths instead of expanding repeated accepted alternatives exponentially',()=>{
  const c=makeV2Case();const task=c.v2!.decoding[0]!;
  task.options[0]!.evidence=['a'];
  task.options.push({...task.options[0]!,id:'alternate',evidence:['b']});
  c.v2!.decoding=Array.from({length:20},(_,i)=>({...task,id:`scope_${i}`}));
  expect(tooling(c).paths).toEqual([['a','b']]);
});
