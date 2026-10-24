import { FRAGMENT_KINDS, type CaseData, type Difficulty, type DocumentVisual } from '../domain/types';

/**
 * 事件 JSON（data/cases/*.json）の検証。
 *
 * 構造の規則は data/schema/case.schema.json と対応させている（パターン・範囲・必須キー・未知キー禁止）。
 * JSON Schema で表現しにくい参照整合（ID の実在、重複、予算で必須資料を全部開けるか等）もここで検査する。
 * 依存ライブラリを増やさず、手書きの型ガードで実装する。
 */

export const CASE_ID_PATTERN = /^case-[0-9]{2}$/;
export const DOCUMENT_ID_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
export const TASK_ID_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
export const FRAGMENT_ID_PATTERN = /^f[0-9]{1,2}$/;

export const DIFFICULTIES: readonly Difficulty[] = ['NORMAL', 'HARD', 'EXPERT'];
export const DOCUMENT_VISUALS: readonly DocumentVisual[] = [
  'advert',
  'report',
  'ledger',
  'news',
  'photo',
  'ticket',
  'clipping',
  'label',
  'receipt',
];

const CASE_KEYS = [
  'id',
  'title',
  'bias',
  'difficulty',
  'estimated_time',
  'intro',
  'budget',
  'documents',
  'required_evidence',
  'required_link',
  'link_prompt',
  'analysis_tasks',
  'headline_fragments',
  'correct_fragments',
  'debrief',
  'disclaimer',
] as const;
const DOCUMENT_KEYS = ['id', 'title', 'content', 'cost', 'visual'] as const;
const TASK_KEYS = ['id', 'prompt', 'unit', 'expected', 'tolerance'] as const;
const FRAGMENT_REQUIRED_KEYS = ['id', 'text'] as const;
const FRAGMENT_OPTIONAL_KEYS = ['kind', 'reason', 'evidence'] as const;
const DEBRIEF_KEYS = ['explanation', 'takeaway'] as const;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

type Obj = Record<string, unknown>;

function isObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** エラー収集のための小さなヘルパ。path は "documents[2].cost" のような形式 */
class Checker {
  readonly errors: string[] = [];

  fail(path: string, message: string): void {
    this.errors.push(`${path}: ${message}`);
  }

  /** 必須キーの存在と未知キーの不在を確認する（optional は在っても無くてもよい） */
  keys(path: string, obj: Obj, required: readonly string[], optional: readonly string[] = []): void {
    for (const k of required) if (!(k in obj)) this.fail(`${path}.${k}`, '必須キーがありません');
    for (const k of Object.keys(obj)) {
      if (!required.includes(k) && !optional.includes(k)) {
        this.fail(`${path}.${k}`, '未知のキーです');
      }
    }
  }

  string(
    path: string,
    v: unknown,
    opts: { minLength?: number; maxLength?: number; pattern?: RegExp } = {},
  ): v is string {
    if (typeof v !== 'string') {
      this.fail(path, '文字列ではありません');
      return false;
    }
    const len = [...v].length;
    if (opts.minLength !== undefined && len < opts.minLength) {
      this.fail(path, `${opts.minLength} 文字以上が必要です（${len} 文字）`);
    }
    if (opts.maxLength !== undefined && len > opts.maxLength) {
      this.fail(path, `${opts.maxLength} 文字以内にしてください（${len} 文字）`);
    }
    if (opts.pattern && !opts.pattern.test(v)) {
      this.fail(path, `パターン ${opts.pattern.source} に一致しません（"${v}"）`);
    }
    return true;
  }

  number(
    path: string,
    v: unknown,
    opts: { integer?: boolean; minimum?: number; maximum?: number } = {},
  ): v is number {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.fail(path, '数値ではありません');
      return false;
    }
    if (opts.integer && !Number.isInteger(v)) this.fail(path, '整数ではありません');
    if (opts.minimum !== undefined && v < opts.minimum) {
      this.fail(path, `${opts.minimum} 以上が必要です（${v}）`);
    }
    if (opts.maximum !== undefined && v > opts.maximum) {
      this.fail(path, `${opts.maximum} 以下にしてください（${v}）`);
    }
    return true;
  }

  enum<T extends string>(path: string, v: unknown, allowed: readonly T[]): v is T {
    if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
      this.fail(path, `${allowed.join(' | ')} のいずれかが必要です（${JSON.stringify(v)}）`);
      return false;
    }
    return true;
  }

  array(
    path: string,
    v: unknown,
    opts: { minItems?: number; maxItems?: number; unique?: boolean } = {},
  ): v is unknown[] {
    if (!Array.isArray(v)) {
      this.fail(path, '配列ではありません');
      return false;
    }
    if (opts.minItems !== undefined && v.length < opts.minItems) {
      this.fail(path, `${opts.minItems} 件以上が必要です（${v.length} 件）`);
    }
    if (opts.maxItems !== undefined && v.length > opts.maxItems) {
      this.fail(path, `${opts.maxItems} 件以内にしてください（${v.length} 件）`);
    }
    if (opts.unique) {
      const seen = new Set<string>();
      v.forEach((item, i) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) this.fail(`${path}[${i}]`, `重複しています（${key}）`);
        seen.add(key);
      });
    }
    return true;
  }
}

/** 文字列 ID の配列を検証し、文字列だったものだけ返す */
function idList(c: Checker, path: string, v: unknown[], pattern: RegExp): string[] {
  const out: string[] = [];
  v.forEach((item, i) => {
    if (c.string(`${path}[${i}]`, item, { pattern })) out.push(item);
  });
  return out;
}

function checkDocuments(c: Checker, raw: unknown): Map<string, number> {
  const costs = new Map<string, number>();
  if (!c.array('documents', raw, { minItems: 5, maxItems: 12 })) return costs;
  raw.forEach((d, i) => {
    const path = `documents[${i}]`;
    if (!isObject(d)) {
      c.fail(path, 'オブジェクトではありません');
      return;
    }
    c.keys(path, d, DOCUMENT_KEYS);
    const idOk = c.string(`${path}.id`, d.id, { pattern: DOCUMENT_ID_PATTERN });
    c.string(`${path}.title`, d.title, { minLength: 1, maxLength: 40 });
    c.string(`${path}.content`, d.content, { minLength: 1 });
    const costOk = c.number(`${path}.cost`, d.cost, { integer: true, minimum: 0, maximum: 9 });
    c.enum(`${path}.visual`, d.visual, DOCUMENT_VISUALS);
    if (idOk) {
      const id = d.id as string;
      if (costs.has(id)) c.fail(`${path}.id`, `資料 ID "${id}" が重複しています`);
      else costs.set(id, costOk ? (d.cost as number) : 0);
    }
  });
  if (raw.length > 0 && ![...costs.values()].some((cost) => cost === 0)) {
    c.fail('documents', 'cost 0 の資料（最初から読める資料）が 1 件以上必要です');
  }
  return costs;
}

function checkTasks(c: Checker, raw: unknown): void {
  if (!c.array('analysis_tasks', raw, { minItems: 2, maxItems: 2 })) return;
  const seen = new Set<string>();
  raw.forEach((t, i) => {
    const path = `analysis_tasks[${i}]`;
    if (!isObject(t)) {
      c.fail(path, 'オブジェクトではありません');
      return;
    }
    c.keys(path, t, TASK_KEYS);
    if (c.string(`${path}.id`, t.id, { pattern: TASK_ID_PATTERN })) {
      if (seen.has(t.id)) c.fail(`${path}.id`, `検証メモ ID "${t.id}" が重複しています`);
      seen.add(t.id);
    }
    c.string(`${path}.prompt`, t.prompt, { minLength: 1 });
    c.string(`${path}.unit`, t.unit, { minLength: 1, maxLength: 10 });
    c.number(`${path}.expected`, t.expected);
    c.number(`${path}.tolerance`, t.tolerance, { minimum: 0 });
  });
}

interface FragmentInfo {
  /** 断片 ID → kind（kind が無い・不正な断片は含めない） */
  kinds: Map<string, string>;
  ids: Set<string>;
}

function checkFragments(c: Checker, raw: unknown, docIds: Set<string>): FragmentInfo {
  const info: FragmentInfo = { kinds: new Map(), ids: new Set() };
  if (!c.array('headline_fragments', raw, { minItems: 8, maxItems: 12 })) return info;
  raw.forEach((f, i) => {
    const path = `headline_fragments[${i}]`;
    if (!isObject(f)) {
      c.fail(path, 'オブジェクトではありません');
      return;
    }
    c.keys(path, f, FRAGMENT_REQUIRED_KEYS, FRAGMENT_OPTIONAL_KEYS);
    const id = c.string(`${path}.id`, f.id, { pattern: FRAGMENT_ID_PATTERN }) ? f.id : undefined;
    if (id !== undefined) {
      if (info.ids.has(id)) c.fail(`${path}.id`, `断片 ID "${id}" が重複しています`);
      info.ids.add(id);
    }
    c.string(`${path}.text`, f.text, { minLength: 1, maxLength: 40 });
    // --- 任意フィールド（あれば検証する） ---
    if ('kind' in f && c.enum(`${path}.kind`, f.kind, FRAGMENT_KINDS) && id !== undefined) {
      info.kinds.set(id, f.kind);
    }
    if ('reason' in f) c.string(`${path}.reason`, f.reason, { minLength: 5, maxLength: 120 });
    if (
      'evidence' in f &&
      c.array(`${path}.evidence`, f.evidence, { minItems: 1, maxItems: 6, unique: true })
    ) {
      idList(c, `${path}.evidence`, f.evidence, DOCUMENT_ID_PATTERN).forEach((id, j) => {
        if (docIds.size > 0 && !docIds.has(id)) {
          c.fail(`${path}.evidence[${j}]`, `資料 ID "${id}" は documents に存在しません`);
        }
      });
    }
  });
  return info;
}

/**
 * 照合の問い。資料名をそのまま含むと正解のネタバレになるので禁止する。
 */
function checkLinkPrompt(c: Checker, raw: unknown, documents: unknown): void {
  if (!c.string('link_prompt', raw, { minLength: 10, maxLength: 120 })) return;
  const prompt = raw as string;
  if (!Array.isArray(documents)) return;
  for (const d of documents) {
    if (isObject(d) && typeof d.title === 'string' && d.title.length > 0 && prompt.includes(d.title)) {
      c.fail('link_prompt', `資料タイトル「${d.title}」を含んでいます（正解の名指しになります）`);
    }
  }
}

function checkDebrief(c: Checker, raw: unknown): void {
  if (!isObject(raw)) {
    c.fail('debrief', 'オブジェクトではありません');
    return;
  }
  c.keys('debrief', raw, DEBRIEF_KEYS);
  c.string('debrief.explanation', raw.explanation, { minLength: 15 });
  c.string('debrief.takeaway', raw.takeaway, { minLength: 8 });
}

/**
 * 不明な値を事件データとして検証する。
 * 問題がなければ ok: true、あれば人が読める形のエラー一覧を返す（答えのデータは一切変更しない）。
 */
export function validateCase(raw: unknown): ValidationResult {
  const c = new Checker();
  if (!isObject(raw)) {
    return { ok: false, errors: ['(root): オブジェクトではありません'] };
  }
  c.keys('(root)', raw, CASE_KEYS);

  c.string('id', raw.id, { pattern: CASE_ID_PATTERN });
  c.string('title', raw.title, { minLength: 3, maxLength: 60 });
  c.string('bias', raw.bias, { minLength: 1, maxLength: 60 });
  c.enum('difficulty', raw.difficulty, DIFFICULTIES);
  c.string('estimated_time', raw.estimated_time, { minLength: 1, maxLength: 20 });
  c.string('intro', raw.intro, { minLength: 10 });
  const budgetOk = c.number('budget', raw.budget, { integer: true, minimum: 1, maximum: 99 });
  c.string('disclaimer', raw.disclaimer, { minLength: 5 });

  const costs = checkDocuments(c, raw.documents);
  checkLinkPrompt(c, raw.link_prompt, raw.documents);
  const docIds = new Set(costs.keys());
  checkTasks(c, raw.analysis_tasks);
  const fragments = checkFragments(c, raw.headline_fragments, docIds);
  const fragmentIds = fragments.ids;
  checkDebrief(c, raw.debrief);

  // --- 参照整合（JSON Schema では表現しにくい規則） ---
  const refDoc = (path: string, id: string) => {
    if (docIds.size > 0 && !docIds.has(id)) {
      c.fail(path, `資料 ID "${id}" は documents に存在しません`);
    }
  };

  if (c.array('required_evidence', raw.required_evidence, { minItems: 3, maxItems: 3, unique: true })) {
    const ids = idList(c, 'required_evidence', raw.required_evidence, DOCUMENT_ID_PATTERN);
    ids.forEach((id, i) => refDoc(`required_evidence[${i}]`, id));
    if (budgetOk && docIds.size > 0 && ids.every((id) => docIds.has(id))) {
      const total = ids.reduce((sum, id) => sum + (costs.get(id) ?? 0), 0);
      if (total > (raw.budget as number)) {
        c.fail(
          'budget',
          `必須資料の合計コスト ${total} が予算 ${raw.budget} を超えています（全部開けません）`,
        );
      }
    }
  }

  if (c.array('required_link', raw.required_link, { minItems: 2, maxItems: 2 })) {
    const ids = idList(c, 'required_link', raw.required_link, DOCUMENT_ID_PATTERN);
    ids.forEach((id, i) => refDoc(`required_link[${i}]`, id));
    if (ids.length === 2 && ids[0] === ids[1]) {
      c.fail('required_link', `同じ資料 "${ids[0]}" 同士は照合できません`);
    }
  }

  if (c.array('correct_fragments', raw.correct_fragments, { minItems: 3, maxItems: 3, unique: true })) {
    const ids = idList(c, 'correct_fragments', raw.correct_fragments, FRAGMENT_ID_PATTERN);
    ids.forEach((id, i) => {
      if (fragmentIds.size > 0 && !fragmentIds.has(id)) {
        c.fail(`correct_fragments[${i}]`, `断片 ID "${id}" は headline_fragments に存在しません`);
      }
    });
    // kind と correct_fragments の両方向整合:
    //   correct_fragments に含まれる断片は kind: 'correct'、含まれない断片は 'correct' 以外
    const correct = new Set(ids);
    for (const [fid, kind] of fragments.kinds) {
      if (correct.has(fid) && kind !== 'correct') {
        c.fail(
          `headline_fragments(${fid}).kind`,
          `correct_fragments に含まれる断片は kind: "correct" でなければなりません（"${kind}"）`,
        );
      } else if (!correct.has(fid) && kind === 'correct') {
        c.fail(
          `headline_fragments(${fid}).kind`,
          'correct_fragments に含まれない断片に kind: "correct" は付けられません',
        );
      }
    }
  }

  return { ok: c.errors.length === 0, errors: c.errors };
}

/** 検証に失敗したら例外を投げる。読み込み時のガードに使う。 */
export function assertCase(raw: unknown, label = '(unknown)'): CaseData {
  const result = validateCase(raw);
  if (!result.ok) {
    throw new Error(
      `事件データ ${label} が不正です（${result.errors.length} 件）:\n- ${result.errors.join('\n- ')}`,
    );
  }
  return raw as CaseData;
}
