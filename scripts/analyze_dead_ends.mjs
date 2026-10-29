#!/usr/bin/env node
/**
 * 調査予算の行き詰まり（詰み）分析。Node 標準モジュールのみ使用。
 *
 *   node scripts/analyze_dead_ends.mjs            # Markdown 表を標準出力へ
 *   node scripts/analyze_dead_ends.mjs --json     # 機械可読 JSON
 *
 * 定義:
 *   v1必要資料 = required_evidence ∪ required_link
 *   V2必要経路 = 各解読タスクの妥当な根拠 × グラフ経路 + 追加開示資料（代替経路を維持）
 *   必要コスト = いずれかの根拠経路を揃える最小コスト
 *   余裕       = budget − 必要コスト
 *   予算内の閲覧集合 = コスト合計が budget 以下の資料部分集合。V2段階ゲートの到達性は別検証。
 *   詰み       = どの根拠経路も、未閲覧の必要資料の合計コストが残予算を超える
 *
 * 出力列:
 *   詰み集合 / 到達可能集合  … 到達可能な閲覧集合のうち詰みに至るものの数
 *   最短詰み手数            … 詰みに到達するまでに必要な最少の有料資料閲覧回数
 *   無作為プレイの詰み率    … 毎回「未閲覧かつ開ける有料資料」から等確率で 1 件開き、
 *                             開ける資料が無くなるまで続けた場合に詰みで終わる確率
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASE_DIR = join(ROOT, 'data', 'cases');

export function loadCases(dir = CASE_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function minimalPaths(paths) {
  const signatures = new Set();
  const unique = paths
    .map((path) => [...path].sort())
    .filter((path) => {
      const key = JSON.stringify(path);
      if (signatures.has(key)) return false;
      signatures.add(key);
      return true;
    });
  return unique.filter(
    (path, _, all) =>
      !all.some((other) => other.length < path.length && other.every((id) => path.includes(id))),
  );
}

/** Alternative complete evidence sets. A case is blocked only when every set is unaffordable. */
export function requiredDocumentPaths(c) {
  if (c.schemaVersion !== 2 || !c.v2)
    return [[...new Set([...c.required_evidence, ...c.required_link])]];
  const fixed = [
    ...(c.v2.experiment?.revealDocuments ?? []),
    ...(c.v2.decision?.revealDocuments ?? []),
  ];
  let paths = c.v2.board
    ? [[]]
    : c.v2.graph.paths.map((path) => [
        ...new Set([...fixed, ...path.flatMap((edge) => [edge.from, edge.to])]),
      ]);
  if (c.v2.board) {
    const board = c.v2.board;
    for (const task of board.tasks)
      paths = minimalPaths(
        paths.flatMap((path) =>
          task.rules.map((rule) => [
            ...new Set([
              ...path,
              ...rule.evidence.map(
                (id) => board.excerpts.find((entry) => entry.id === id).documentId,
              ),
            ]),
          ]),
        ),
      );
    paths = paths.map((path) => [...new Set([...fixed, ...path])]);
  }
  for (const task of c.v2.decoding) {
    paths = minimalPaths(
      paths.flatMap((path) =>
        task.options
          .filter((option) => option.accepted)
          .map((option) => [...new Set([...path, ...option.evidence])]),
      ),
    );
  }
  return minimalPaths(paths);
}

export function analyzeCase(c) {
  const docs = c.documents;
  const paths = requiredDocumentPaths(c);
  const allNeeded = new Set(paths.flat());
  for (const id of allNeeded)
    if (!docs.some((doc) => doc.id === id)) throw new Error(`${c.id}: 不明な資料 ${id}`);
  const costOf = (set) => docs.filter((d) => set.has(d.id)).reduce((s, d) => s + d.cost, 0);
  const ranked = paths
    .map((path) => ({ path, cost: costOf(new Set(path)) }))
    .sort((a, b) => a.cost - b.cost);
  const neededCost = ranked[0]?.cost ?? Infinity;
  const neededDocs = docs.filter((d) => ranked[0]?.path.includes(d.id));
  const slack = c.budget - neededCost;
  const distractors = docs.filter((d) => !allNeeded.has(d.id) && d.cost > 0);
  const isDeadEnd = (opened) =>
    !paths.some((path) => costOf(new Set([...opened, ...path])) <= c.budget);

  // 全部分集合の列挙（資料数は高々 10 件程度なので 2^n で十分）
  let reachable = 0;
  let deadEnd = 0;
  let shortest = Infinity;
  const n = docs.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const opened = new Set();
    let paidOpens = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        opened.add(docs[i].id);
        if (docs[i].cost > 0) paidOpens++;
      }
    }
    if (costOf(opened) > c.budget) continue;
    reachable++;
    if (isDeadEnd(opened)) {
      deadEnd++;
      if (paidOpens < shortest) shortest = paidOpens;
    }
  }

  // 無作為プレイ: 開ける有料資料から等確率で 1 件開く、を続ける（メモ化付き再帰）
  const memo = new Map();
  const randomDeadEndRate = (opened) => {
    const key = [...opened].sort().join(',');
    if (memo.has(key)) return memo.get(key);
    const remaining = c.budget - costOf(opened);
    const choices = docs.filter((d) => d.cost > 0 && !opened.has(d.id) && d.cost <= remaining);
    let p;
    if (choices.length === 0) p = isDeadEnd(opened) ? 1 : 0;
    else {
      p = 0;
      for (const d of choices) p += randomDeadEndRate(new Set([...opened, d.id])) / choices.length;
    }
    memo.set(key, p);
    return p;
  };

  return {
    id: c.id,
    title: c.title,
    difficulty: c.difficulty,
    budget: c.budget,
    documentCount: docs.length,
    neededIds: neededDocs.map((d) => d.id),
    requiredPaths: paths,
    analysisScope: 'budget-only; phase gates are tested in domain/E2E',
    completableFromStart: neededCost <= c.budget,
    neededCost,
    slack,
    distractorIds: distractors.map((d) => d.id),
    distractorCost: distractors.reduce((s, d) => s + d.cost, 0),
    reachableSubsets: reachable,
    deadEndSubsets: deadEnd,
    shortestDeadEndMoves: Number.isFinite(shortest) ? shortest : null,
    randomPlayDeadEndRate: randomDeadEndRate(new Set()),
  };
}

export function toMarkdown(rows) {
  const pct = (a, b) => (b === 0 ? '-' : `${((100 * a) / b).toFixed(1)}%`);
  const lines = [
    '| ケース | 難易度 | 予算 | 最安の根拠経路 | 必要コスト | 余裕 | 外れ資料コスト | 詰み集合 / 到達可能集合 | 最短詰み手数 | 無作為プレイの詰み率 |',
    '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.id} | ${r.difficulty} | ${r.budget} | ${r.neededIds.join(', ')} | ${r.neededCost} | ${r.slack} | ${r.distractorCost} | ${r.deadEndSubsets} / ${r.reachableSubsets} (${pct(r.deadEndSubsets, r.reachableSubsets)}) | ${r.shortestDeadEndMoves ?? 'なし'} | ${(100 * r.randomPlayDeadEndRate).toFixed(1)}% |`,
    );
  }
  lines.push(
    '',
    '予算のみの分析。V2は全解読タスクの妥当な根拠と証拠ボードの経路・開示資料の組合せを列挙し、どの経路も予算に収まらないときだけ行き詰まりとする。段階ゲート・初回判断前の開示防止はドメイン/E2Eで別途検証する。',
    '高難易度や楽しさをこの数値だけで判定しない。',
  );
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const rows = loadCases().map(analyzeCase);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else console.log(toMarkdown(rows));
  if (process.argv.includes('--check') && rows.some((row) => !row.completableFromStart))
    process.exitCode = 1;
}
