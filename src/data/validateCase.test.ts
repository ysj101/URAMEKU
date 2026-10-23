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
import { FRAGMENT_KINDS } from '../domain/types';

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

describe('validateCase: 断片の kind / reason / evidence', () => {
  type Frag = Record<string, unknown>;
  function withFragments(mutate: (frags: Frag[]) => void): Record<string, unknown> {
    const data = raw();
    const frags = data.headline_fragments as Frag[];
    // フィクスチャは f0-f2 が正解。全断片に整合した kind を付けてから mutate する
    frags.forEach((f, i) => {
      f.kind = i < 3 ? 'correct' : 'other';
      f.reason = `断片${i}の理由です。`;
      f.evidence = ['a'];
    });
    mutate(frags);
    return data;
  }
  function errorsOf(data: unknown): string[] {
    const r = validateCase(data);
    expect(r.ok).toBe(false);
    return r.errors;
  }

  it('スキーマの kind 列挙と FRAGMENT_KINDS が一致する', () => {
    expect(schema.$defs.fragmentKind.enum).toEqual([...FRAGMENT_KINDS]);
    expect(Object.keys(schema.$defs.headlineFragment.properties)).toEqual([
      'id',
      'text',
      'kind',
      'reason',
      'evidence',
    ]);
  });

  it('任意フィールドが無くても、整合していれば通る', () => {
    expect(validateCase(raw()).ok).toBe(true);
    expect(validateCase(withFragments(() => {}))).toEqual({ ok: true, errors: [] });
    // 一部の断片にだけ付いていてもよい
    const partial = withFragments((frags) => {
      delete frags[7]!.kind;
      delete frags[7]!.reason;
      delete frags[7]!.evidence;
    });
    expect(validateCase(partial).ok).toBe(true);
  });

  it('kind の列挙違反・reason の型/長さ・evidence の型', () => {
    const errors = errorsOf(
      withFragments((frags) => {
        frags[3]!.kind = 'typo';
        frags[4]!.reason = 42;
        frags[5]!.reason = '短い';
        frags[6]!.evidence = 'a';
        frags[7]!.evidence = [];
      }),
    );
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[3\]\.kind: correct \| /));
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[4\]\.reason: 文字列/));
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[5\]\.reason: 5 文字以上/));
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[6\]\.evidence: 配列/));
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[7\]\.evidence: 1 件以上/));
  });

  it('evidence が存在しない資料・重複を指す', () => {
    const errors = errorsOf(
      withFragments((frags) => {
        frags[3]!.evidence = ['a', 'ghost'];
        frags[4]!.evidence = ['b', 'b'];
      }),
    );
    expect(errors).toContainEqual(
      expect.stringMatching(/headline_fragments\[3\]\.evidence\[1\]: 資料 ID "ghost" は documents に存在しません/),
    );
    expect(errors).toContainEqual(expect.stringMatching(/headline_fragments\[4\]\.evidence\[1\]: 重複/));
  });

  it('correct_fragments に含まれる断片の kind が correct でない', () => {
    const errors = errorsOf(
      withFragments((frags) => {
        frags[1]!.kind = 'misread-statistic';
      }),
    );
    expect(errors).toEqual([
      expect.stringMatching(/headline_fragments\(f1\)\.kind: correct_fragments に含まれる断片は kind: "correct"/),
    ]);
  });

  it('correct_fragments に含まれない断片に kind: correct が付いている', () => {
    const errors = errorsOf(
      withFragments((frags) => {
        frags[5]!.kind = 'correct';
      }),
    );
    expect(errors).toEqual([
      expect.stringMatching(/headline_fragments\(f5\)\.kind: correct_fragments に含まれない断片に kind: "correct"/),
    ]);
  });

  it('答えを kind の付け替えで変えても correct_fragments が優先され、不整合として拒否される', () => {
    // f0-f2 → f3-f5 に kind だけ移した状態
    const errors = errorsOf(
      withFragments((frags) => {
        for (let i = 0; i < 3; i++) frags[i]!.kind = 'other';
        for (let i = 3; i < 6; i++) frags[i]!.kind = 'correct';
      }),
    );
    expect(errors).toHaveLength(6);
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
