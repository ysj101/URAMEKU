#!/usr/bin/env node
/**
 * data/cases/*.json を data/schema/case.schema.json と参照整合ルールで検証する CLI。
 * 依存パッケージなし（Node 20+）。終了コード 0 = すべて OK、1 = 不正データあり、2 = 実行エラー。
 *
 *   npm run validate:cases
 *   node scripts/validate_cases.mjs [files...]
 *
 * JSON Schema は本リポジトリのスキーマが使う語彙だけを解釈する最小実装
 * （type / enum / const / pattern / minLength / maxLength / minimum / maximum /
 *   required / properties / additionalProperties / items / minItems / maxItems / uniqueItems / $ref）。
 * アプリ側の実行時検証は src/data/validateCase.ts（同じ規則を手書き型ガードで実装）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = join(ROOT, 'data', 'schema', 'case.schema.json');
const CASES_DIR = join(ROOT, 'data', 'cases');

// ---------- 最小 JSON Schema 評価器 ----------

const sub = (path, key) => (path ? `${path}.${key}` : key);

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function matchesType(v, t) {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`未対応の $ref: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((node, key) => {
      if (node === undefined || !(key in node)) throw new Error(`$ref が解決できません: ${ref}`);
      return node[key];
    }, root);
}

const SUPPORTED = new Set([
  '$schema',
  '$id',
  'title',
  'description',
  '$defs',
  '$ref',
  'type',
  'enum',
  'const',
  'pattern',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
]);

function validateSchema(root, schema, value, path, errors) {
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key)) throw new Error(`スキーマ語彙 "${key}" は未対応です（${path}）`);
  }
  if (schema.$ref) {
    validateSchema(root, resolveRef(root, schema.$ref), value, path, errors);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path || '(root)'}: 型 ${types.join('|')} が必要です（${typeOf(value)}）`);
      return;
    }
  }
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    errors.push(
      `${path}: ${schema.enum.join(' | ')} のいずれかが必要です（${JSON.stringify(value)}）`,
    );
  }
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    errors.push(`${path}: ${JSON.stringify(schema.const)} でなければなりません`);
  }
  if (typeof value === 'string') {
    const len = [...value].length;
    if (schema.minLength !== undefined && len < schema.minLength) {
      errors.push(`${path}: ${schema.minLength} 文字以上が必要です（${len} 文字）`);
    }
    if (schema.maxLength !== undefined && len > schema.maxLength) {
      errors.push(`${path}: ${schema.maxLength} 文字以内にしてください（${len} 文字）`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${path}: パターン ${schema.pattern} に一致しません（"${value}"）`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${schema.minimum} 以上が必要です（${value}）`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${schema.maximum} 以下にしてください（${value}）`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: ${schema.minItems} 件以上が必要です（${value.length} 件）`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: ${schema.maxItems} 件以内にしてください（${value.length} 件）`);
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      value.forEach((item, i) => {
        const k = JSON.stringify(item);
        if (seen.has(k)) errors.push(`${path}[${i}]: 重複しています（${k}）`);
        seen.add(k);
      });
    }
    if (schema.items) {
      value.forEach((item, i) => validateSchema(root, schema.items, item, `${path}[${i}]`, errors));
    }
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required ?? []) {
      if (!(k in value)) errors.push(`${sub(path, k)}: 必須キーがありません`);
    }
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      if (k in props) validateSchema(root, props[k], v, sub(path, k), errors);
      else if (schema.additionalProperties === false)
        errors.push(`${sub(path, k)}: 未知のキーです`);
    }
  }
}

// ---------- 参照整合（src/data/validateCase.ts と同じ規則） ----------

function validateIntegrity(c, errors) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.documents)) return;
  const costs = new Map();
  c.documents.forEach((d, i) => {
    if (!d || typeof d.id !== 'string') return;
    if (costs.has(d.id)) errors.push(`documents[${i}].id: 資料 ID "${d.id}" が重複しています`);
    else costs.set(d.id, typeof d.cost === 'number' ? d.cost : 0);
  });
  if (costs.size > 0 && ![...costs.values()].includes(0)) {
    errors.push('documents: cost 0 の資料（最初から読める資料）が 1 件以上必要です');
  }
  const refDoc = (path, id) => {
    if (typeof id === 'string' && costs.size > 0 && !costs.has(id)) {
      errors.push(`${path}: 資料 ID "${id}" は documents に存在しません`);
    }
  };
  if (Array.isArray(c.required_evidence)) {
    c.required_evidence.forEach((id, i) => refDoc(`required_evidence[${i}]`, id));
    if (Number.isInteger(c.budget) && c.required_evidence.every((id) => costs.has(id))) {
      const total = c.required_evidence.reduce((s, id) => s + costs.get(id), 0);
      if (total > c.budget) {
        errors.push(
          `budget: 必須資料の合計コスト ${total} が予算 ${c.budget} を超えています（全部開けません）`,
        );
      }
    }
  }
  if (Array.isArray(c.required_link)) {
    c.required_link.forEach((id, i) => refDoc(`required_link[${i}]`, id));
    if (c.required_link.length === 2 && c.required_link[0] === c.required_link[1]) {
      errors.push(`required_link: 同じ資料 "${c.required_link[0]}" 同士は照合できません`);
    }
  }
  const taskIds = new Set();
  for (const [i, t] of (Array.isArray(c.analysis_tasks) ? c.analysis_tasks : []).entries()) {
    if (!t || typeof t.id !== 'string') continue;
    if (taskIds.has(t.id))
      errors.push(`analysis_tasks[${i}].id: 検証メモ ID "${t.id}" が重複しています`);
    taskIds.add(t.id);
  }
  const fragmentIds = new Set();
  const fragmentKinds = new Map();
  for (const [i, f] of (Array.isArray(c.headline_fragments)
    ? c.headline_fragments
    : []
  ).entries()) {
    if (!f || typeof f.id !== 'string') continue;
    if (fragmentIds.has(f.id))
      errors.push(`headline_fragments[${i}].id: 断片 ID "${f.id}" が重複しています`);
    fragmentIds.add(f.id);
    if (typeof f.kind === 'string') fragmentKinds.set(f.id, f.kind);
    if (Array.isArray(f.evidence)) {
      f.evidence.forEach((id, j) => refDoc(`headline_fragments[${i}].evidence[${j}]`, id));
    }
  }
  if (Array.isArray(c.correct_fragments) && fragmentIds.size > 0) {
    c.correct_fragments.forEach((id, i) => {
      if (typeof id === 'string' && !fragmentIds.has(id)) {
        errors.push(
          `correct_fragments[${i}]: 断片 ID "${id}" は headline_fragments に存在しません`,
        );
      }
    });
    // kind と correct_fragments の両方向整合
    const correct = new Set(c.correct_fragments);
    for (const [fid, kind] of fragmentKinds) {
      if (correct.has(fid) && kind !== 'correct') {
        errors.push(
          `headline_fragments(${fid}).kind: correct_fragments に含まれる断片は kind: "correct" でなければなりません（"${kind}"）`,
        );
      } else if (!correct.has(fid) && kind === 'correct') {
        errors.push(
          `headline_fragments(${fid}).kind: correct_fragments に含まれない断片に kind: "correct" は付けられません`,
        );
      }
    }
  }
}

export function validateCaseJson(schema, data) {
  const errors = [];
  validateSchema(schema, schema, data, '', errors);
  if (errors.length === 0 && (data === null || typeof data !== 'object'))
    errors.push('(root): オブジェクトではありません');
  validateIntegrity(data, errors);
  return errors;
}

// ---------- CLI ----------

function main(argv) {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const files =
    argv.length > 0
      ? argv.map((f) => resolve(f))
      : readdirSync(CASES_DIR)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => join(CASES_DIR, f));
  if (files.length === 0) {
    console.error(`検証対象がありません: ${CASES_DIR}`);
    return 2;
  }
  let failed = 0;
  let documents = 0;
  const ids = new Set();
  for (const file of files) {
    const name = basename(file);
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`NG ${name}: JSON を読めません: ${e.message}`);
      failed++;
      continue;
    }
    const errors = validateCaseJson(schema, data);
    if (data && typeof data.id === 'string') {
      if (ids.has(data.id)) errors.push(`id: 事件 ID "${data.id}" が他のファイルと重複しています`);
      ids.add(data.id);
      if (data.id !== name.replace(/\.json$/, '')) {
        errors.push(`id: 事件 ID "${data.id}" とファイル名 ${name} が一致しません`);
      }
    }
    if (errors.length > 0) {
      failed++;
      console.error(`NG ${name} (${errors.length} 件)`);
      for (const e of errors) console.error(`   - ${e}`);
    } else {
      const n = data.documents.length;
      documents += n;
      console.log(`OK ${name}: ${data.id} / 資料 ${n} 件`);
    }
  }
  console.log(`---\n${files.length} 件中 ${files.length - failed} 件 OK、資料 ${documents} 件`);
  return failed > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`実行エラー: ${e.message}`);
    process.exit(2);
  }
}
