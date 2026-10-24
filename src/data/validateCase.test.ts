import schema from '../../data/schema/case.schema.json';
import { CASES } from './cases';
import {
  CASE_ID_PATTERN,
  DOCUMENT_ID_PATTERN,
  DOCUMENT_VISUALS,
  FRAGMENT_ID_PATTERN,
  TASK_ID_PATTERN,
  assertCase,
  validateCase,
} from './validateCase';
import { makeCase } from '../test/fixtures';

/** JSON を介して深いコピーを作り、任意に壊せるようにする */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(makeCase())), ...overrides };
}

describe('validateCase: 実データ', () => {
  it('data/cases の 5 件 / 30 資料がすべて検証に通る', () => {
    expect(CASES).toHaveLength(5);
    expect(CASES.reduce((n, c) => n + c.documents.length, 0)).toBe(30);
    for (const c of CASES) {
      const r = validateCase(c);
      expect(r.errors, `${c.id}: ${r.errors.join(' / ')}`).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });

  it('テスト用フィクスチャも検証に通る', () => {
    expect(validateCase(makeCase())).toEqual({ ok: true, errors: [] });
  });
});

describe('validateCase: スキーマとの整合', () => {
  it('ID のパターンと列挙は case.schema.json と一致する', () => {
    expect(schema.properties.id.pattern).toBe(CASE_ID_PATTERN.source);
    expect(schema.$defs.documentId.pattern).toBe(DOCUMENT_ID_PATTERN.source);
    expect(schema.$defs.taskId.pattern).toBe(TASK_ID_PATTERN.source);
    expect(schema.$defs.fragmentId.pattern).toBe(FRAGMENT_ID_PATTERN.source);
    expect(schema.$defs.visual.enum).toEqual([...DOCUMENT_VISUALS]);
    expect(schema.title).toBe('ウラメク case data');
  });
});

describe('validateCase: 不正データを拒否する', () => {
  function errorsOf(data: unknown): string[] {
    const r = validateCase(data);
    expect(r.ok).toBe(false);
    return r.errors;
  }

  it('オブジェクトでない入力', () => {
    expect(errorsOf(null)[0]).toMatch(/オブジェクト/);
    expect(errorsOf([])[0]).toMatch(/オブジェクト/);
    expect(errorsOf('case')[0]).toMatch(/オブジェクト/);
  });

  it('必須キーの欠落', () => {
    const data = raw();
    delete data.debrief;
    expect(errorsOf(data)).toEqual(expect.arrayContaining([expect.stringMatching(/debrief: 必須キー/)]));
  });

  it('未知のキー（ルート・資料・断片）', () => {
    expect(errorsOf(raw({ extra: 1 }))).toContainEqual(expect.stringMatching(/\(root\)\.extra: 未知/));
    const data = raw();
    (data.documents as Record<string, unknown>[])[0]!.note = 'x';
    (data.headline_fragments as Record<string, unknown>[])[1]!.hint = 'x';
    const errors = errorsOf(data);
    expect(errors).toContainEqual(expect.stringMatching(/documents\[0\]\.note: 未知/));
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[1\]\.hint: 未知/));
  });

  it('ID のパターン違反', () => {
    expect(errorsOf(raw({ id: 'case-1' }))).toContainEqual(expect.stringMatching(/^id: パターン/));
    const data = raw();
    (data.documents as Record<string, unknown>[])[1]!.id = 'Doc-A';
    expect(errorsOf(data)).toContainEqual(expect.stringMatching(/documents\[1\]\.id: パターン/));
    expect(errorsOf(raw({ correct_fragments: ['f0', 'f1', 'x2'] }))).toContainEqual(
      expect.stringMatching(/correct_fragments\[2\]: パターン/),
    );
  });

  it('存在しない資料 ID を required_evidence に指定', () => {
    expect(errorsOf(raw({ required_evidence: ['a', 'b', 'ghost'] }))).toContainEqual(
      expect.stringMatching(/required_evidence\[2\]: 資料 ID "ghost" は documents に存在しません/),
    );
  });

  it('required_evidence の重複', () => {
    expect(errorsOf(raw({ required_evidence: ['a', 'a', 'b'] }))).toContainEqual(
      expect.stringMatching(/required_evidence\[1\]: 重複/),
    );
  });

  it('required_link の自己参照・存在しない ID', () => {
    expect(errorsOf(raw({ required_link: ['a', 'a'] }))).toContainEqual(
      expect.stringMatching(/required_link: 同じ資料 "a" 同士/),
    );
    expect(errorsOf(raw({ required_link: ['a', 'nope'] }))).toContainEqual(
      expect.stringMatching(/required_link\[1\]: 資料 ID "nope"/),
    );
    expect(errorsOf(raw({ required_link: ['a'] }))).toContainEqual(
      expect.stringMatching(/required_link: 2 件以上/),
    );
  });

  it('correct_fragments が存在しない断片・重複を指す', () => {
    expect(errorsOf(raw({ correct_fragments: ['f0', 'f1', 'f9'] }))).toContainEqual(
      expect.stringMatching(/correct_fragments\[2\]: 断片 ID "f9"/),
    );
    expect(errorsOf(raw({ correct_fragments: ['f0', 'f0', 'f1'] }))).toContainEqual(
      expect.stringMatching(/correct_fragments\[1\]: 重複/),
    );
  });

  it('tolerance の負値・expected が数値でない', () => {
    const data = raw();
    const tasks = data.analysis_tasks as Record<string, unknown>[];
    tasks[0]!.tolerance = -0.1;
    tasks[1]!.expected = '200';
    const errors = errorsOf(data);
    expect(errors).toContainEqual(expect.stringMatching(/analysis_tasks\[0\]\.tolerance: 0 以上/));
    expect(errors).toContainEqual(expect.stringMatching(/analysis_tasks\[1\]\.expected: 数値/));
  });

  it('budget 不足（必須資料の合計コストが予算を超える）', () => {
    // フィクスチャの必須資料 a, b, c は各 cost 1 → 合計 3
    expect(errorsOf(raw({ budget: 2 }))).toContainEqual(
      expect.stringMatching(/budget: 必須資料の合計コスト 3 が予算 2 を超えています/),
    );
    expect(validateCase(raw({ budget: 3 })).ok).toBe(true);
  });

  it('budget が整数でない・0 以下', () => {
    expect(errorsOf(raw({ budget: 0 }))).toContainEqual(expect.stringMatching(/budget: 1 以上/));
    expect(errorsOf(raw({ budget: 3.5 }))).toContainEqual(expect.stringMatching(/budget: 整数/));
  });

  it('cost 0 の資料がない', () => {
    const data = raw();
    (data.documents as Record<string, unknown>[])[0]!.cost = 1;
    expect(errorsOf(data)).toContainEqual(expect.stringMatching(/documents: cost 0 の資料/));
  });

  it('資料 ID・断片 ID・検証メモ ID の重複', () => {
    const data = raw();
    (data.documents as Record<string, unknown>[])[4]!.id = 'a';
    (data.headline_fragments as Record<string, unknown>[])[7]!.id = 'f0';
    (data.analysis_tasks as Record<string, unknown>[])[1]!.id = 't1';
    const errors = errorsOf(data);
    expect(errors).toContainEqual(expect.stringMatching(/documents\[4\]\.id: 資料 ID "a" が重複/));
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[7\]\.id: 断片 ID "f0" が重複/));
    expect(errors).toContainEqual(expect.stringMatching(/analysis_tasks\[1\]\.id: 検証メモ ID "t1" が重複/));
  });

  it('列挙値・件数の違反', () => {
    expect(errorsOf(raw({ difficulty: 'EASY' }))).toContainEqual(expect.stringMatching(/^difficulty:/));
    const data = raw();
    (data.documents as Record<string, unknown>[])[2]!.visual = 'poster';
    expect(errorsOf(data)).toContainEqual(expect.stringMatching(/documents\[2\]\.visual:/));
    expect(errorsOf(raw({ documents: (raw().documents as unknown[]).slice(0, 4) }))).toContainEqual(
      expect.stringMatching(/documents: 5 件以上/),
    );
    expect(errorsOf(raw({ headline_fragments: (raw().headline_fragments as unknown[]).slice(0, 7) })))
      .toContainEqual(expect.stringMatching(/headline_fragments: 8 件以上/));
  });
});

describe('assertCase', () => {
  it('正しいデータはそのまま返す', () => {
    const data = makeCase();
    expect(assertCase(data, 'fixture')).toBe(data);
  });
  it('不正なデータはラベル付きの例外を投げる', () => {
    expect(() => assertCase(raw({ budget: 1 }), 'case-99.json')).toThrow(/case-99\.json が不正です/);
  });
});
