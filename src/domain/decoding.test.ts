import { describe, expect, it } from 'vitest';
import { completedDecodingCount, decodingReviews } from './decoding';
import { makeV2Case, makeV2Progress } from '../test/mechanicsFixtures';

const data = makeV2Case();
const record = (optionId: string, evidence = ['a', 'b']) => {
  const progress = makeV2Progress();
  progress.v2!.decoding.scope = { optionId, evidence };
  return progress;
};

describe('information decoding', () => {
  it('requires reading every piece of evidence, without charging twice', () => {
    const progress = record('limited');
    expect(completedDecodingCount(data, progress)).toBe(1);
    expect(progress.opened).toEqual(['a', 'b', 'c']);
    expect(completedDecodingCount(data, { ...progress, opened: ['a'] })).toBe(0);
    // 根拠は記録ではなく、答えが参照する資料を読んだかどうかから自動判定する
    expect(completedDecodingCount(data, record('limited', []))).toBe(1);
  });
  it('distinguishes an unknown scope from a factually contradicted generalisation', () => {
    expect(decodingReviews(data, record('open'))[0]).toMatchObject({
      status: 'uncertain',
      factuallyConsistent: true,
    });
    expect(decodingReviews(data, record('everyone'))[0]).toMatchObject({
      grounded: true,
      factuallyConsistent: false,
    });
  });
  it('rejects unknown choices and ignores stray evidence ids in the record', () => {
    expect(completedDecodingCount(data, record('missing'))).toBe(0);
    expect(completedDecodingCount(data, record('limited', ['a', 'b', 'fake']))).toBe(1);
  });
});
