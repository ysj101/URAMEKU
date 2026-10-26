#!/usr/bin/env node
/**
 * data/cases/*.json から編集者向け攻略資料の「自動生成セクション」を作り、
 * docs/walkthrough/case-NN.md のマーカー区間に埋め込む。
 *
 *   npm run walkthrough            … 生成して書き込む
 *   npm run walkthrough -- --check … 生成結果と現状が一致するか確認（CI 用、差分があれば終了コード 1）
 *
 * マーカー `<!-- generated:start -->` 〜 `<!-- generated:end -->` の外側（手書きセクション）は変更しない。
 * ファイルが無い場合は手書きセクションのひな形付きで新規作成する。
 * Node 標準モジュールのみ使用。データ (`data/`) や `src/` は読むだけで書かない。
 */
import { requiredDocumentPaths } from './analyze_dead_ends.mjs';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_DIR = join(ROOT, 'data', 'cases');
const OUT_DIR = join(ROOT, 'docs', 'walkthrough');
const START = '<!-- generated:start -->';
const END = '<!-- generated:end -->';

/** docs/GAME_RULES.md 7 章の配点（src/domain/scoring.ts の SCORE_WEIGHTS と同値） */
const SCORE = {
  evidencePerItem: 8,
  evidenceMax: 24,
  link: 20,
  calculationPerItem: 13,
  calculationMax: 26,
  fragmentPerItem: 8,
  fragmentMax: 24,
  budgetPerPoint: 2,
  budgetMax: 6,
};

const checkMode = process.argv.includes('--check');

function loadCases() {
  return readdirSync(CASES_DIR)
    .filter((f) => /^case-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(CASES_DIR, f), 'utf8')));
}

function docById(c, id) {
  const d = c.documents.find((x) => x.id === id);
  if (!d) throw new Error(`${c.id}: 資料 ${id} が documents にありません`);
  return d;
}

function fragById(c, id) {
  const f = c.headline_fragments.find((x) => x.id === id);
  if (!f) throw new Error(`${c.id}: 断片 ${id} が headline_fragments にありません`);
  return f;
}

/** 表セル用に `|` と改行を無害化 */
function cell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatNumber(n) {
  return Number.isInteger(n) ? String(n) : String(n);
}

function analyze(c) {
  const requiredSet = new Set(c.required_evidence);
  const linkSet = new Set(c.required_link);
  // 最小コスト = required_evidence ∪ required_link のコスト合計（照合には採用が、採用には閲覧が必要）
  const mustOpen = c.documents.filter((d) => requiredSet.has(d.id) || linkSet.has(d.id));
  const minCost = mustOpen.reduce((s, d) => s + d.cost, 0);
  const remaining = c.budget - minCost;
  const budgetBonus = Math.min(SCORE.budgetMax, Math.max(0, remaining) * SCORE.budgetPerPoint);
  const fullWithoutBudget =
    Math.min(SCORE.evidenceMax, c.required_evidence.length * SCORE.evidencePerItem) +
    SCORE.link +
    Math.min(SCORE.calculationMax, c.analysis_tasks.length * SCORE.calculationPerItem) +
    Math.min(SCORE.fragmentMax, c.correct_fragments.length * SCORE.fragmentPerItem);
  const bestScore = fullWithoutBudget + budgetBonus;

  // 外れ資料（必要でも照合でもない、コスト > 0 の資料）
  const decoys = c.documents.filter((d) => !requiredSet.has(d.id) && !linkSet.has(d.id));
  const paidDecoys = decoys.filter((d) => d.cost > 0);

  // 外れを 1 件ずつ開いた場合の残予算とクリア可否
  const detours = paidDecoys.map((d) => {
    const rem = c.budget - minCost - d.cost;
    return {
      doc: d,
      remaining: rem,
      clearable: rem >= 0,
      score:
        rem >= 0 ? fullWithoutBudget + Math.min(SCORE.budgetMax, rem * SCORE.budgetPerPoint) : null,
    };
  });

  // 連続で何件の外れ（最安）を開いてもクリアできるか
  const sortedDecoyCosts = paidDecoys.map((d) => d.cost).sort((a, b) => a - b);
  let slack = remaining;
  let tolerated = 0;
  for (const cost of sortedDecoyCosts) {
    if (slack - cost < 0) break;
    slack -= cost;
    tolerated += 1;
  }

  return {
    mustOpen,
    minCost,
    remaining,
    budgetBonus,
    fullWithoutBudget,
    bestScore,
    decoys,
    detours,
    tolerated,
    requiredSet,
    linkSet,
  };
}

function roleOf(c, a, d) {
  const roles = [];
  if (a.requiredSet.has(d.id)) roles.push('必要証拠');
  if (a.linkSet.has(d.id)) roles.push('照合');
  if (roles.length === 0) roles.push('外れ');
  return roles.join('・');
}

export function renderGenerated(c) {
  if (c.schemaVersion === 2 && c.v2) return renderV2(c);
  const a = analyze(c);
  const L = [];
  L.push(START);
  L.push(
    '<!-- このブロックは scripts/generate_walkthrough.mjs が data/cases/' +
      c.id +
      '.json から生成します。直接編集しないでください。 -->',
  );
  L.push('');
  L.push('## 自動生成: 答え合わせ');
  L.push('');
  L.push('### 基本情報');
  L.push('');
  L.push('| 項目 | 値 |');
  L.push('| --- | --- |');
  L.push(`| ID | \`${c.id}\` |`);
  L.push(`| タイトル | ${cell(c.title)} |`);
  L.push(`| 主題 | ${cell(c.bias)} |`);
  L.push(`| 難易度 | ${c.difficulty} |`);
  L.push(`| 調査予算 | ${c.budget} |`);
  L.push(`| 導入 | ${cell(c.intro)} |`);
  L.push('');
  L.push('### 資料一覧');
  L.push('');
  L.push('| ID | 役割 | コスト | タイトル | 本文 |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const d of c.documents) {
    L.push(
      `| \`${d.id}\` | ${roleOf(c, a, d)} | ${d.cost} | ${cell(d.title)} | ${cell(d.content)} |`,
    );
  }
  L.push('');
  L.push('### 必要証拠（すべて採用＝ピン留めが必要）');
  L.push('');
  for (const id of c.required_evidence) {
    const d = docById(c, id);
    L.push(`- \`${id}\` ${d.title}（コスト ${d.cost}）`);
  }
  L.push('');
  L.push('### 照合（順不同、この 2 枚の集合だけが正解）');
  L.push('');
  const [l1, l2] = c.required_link.map((id) => docById(c, id));
  L.push(`- \`${l1.id}\` ${l1.title} × \`${l2.id}\` ${l2.title}`);
  const linkOnly = c.required_link.filter((id) => !a.requiredSet.has(id));
  if (linkOnly.length > 0) {
    L.push(
      `- 注意: ${linkOnly.map((id) => `\`${id}\``).join(', ')} は必要証拠ではないが、照合に使うので閲覧して採用する必要がある。`,
    );
  }
  L.push('');
  L.push('### 検証メモ（数値入力）');
  L.push('');
  L.push('| ID | 設問 | 正解 | 単位 | 許容誤差 | 受理される範囲 |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  for (const t of c.analysis_tasks) {
    const lo = formatNumber(Math.round((t.expected - t.tolerance) * 1e6) / 1e6);
    const hi = formatNumber(Math.round((t.expected + t.tolerance) * 1e6) / 1e6);
    const range = t.tolerance === 0 ? `${formatNumber(t.expected)} ちょうど` : `${lo} 〜 ${hi}`;
    L.push(
      `| \`${t.id}\` | ${cell(t.prompt)} | **${formatNumber(t.expected)}** | ${cell(t.unit)} | ±${formatNumber(t.tolerance)} | ${range} |`,
    );
  }
  L.push('');
  L.push('入力は数値のみ（`%` や単位を付けると不正解）。判定は `|入力 − 正解| ≤ 許容誤差`。');
  L.push('');
  L.push('### 見出し断片（正解の順序）');
  L.push('');
  c.correct_fragments.forEach((id, i) => {
    L.push(`${i + 1}. \`${id}\` ${fragById(c, id).text}`);
  });
  L.push('');
  L.push('不正解の断片:');
  L.push('');
  for (const f of c.headline_fragments) {
    if (!c.correct_fragments.includes(f.id)) L.push(`- \`${f.id}\` ${f.text}`);
  }
  L.push('');
  L.push('### コストとスコア');
  L.push('');
  L.push('| 項目 | 値 |');
  L.push('| --- | --- |');
  L.push(
    `| 最小コスト（必要証拠 ∪ 照合資料） | **${a.minCost}**（${a.mustOpen.map((d) => `\`${d.id}\`:${d.cost}`).join(', ')}） |`,
  );
  L.push(`| 調査予算 | ${c.budget} |`);
  L.push(`| 最小コスト時の残予算 | ${a.remaining} |`);
  L.push(
    `| 予算ボーナス | min(${SCORE.budgetMax}, ${a.remaining} × ${SCORE.budgetPerPoint}) = ${a.budgetBonus} |`,
  );
  L.push(
    `| 予算以外の満点 | ${a.fullWithoutBudget}（証拠 ${Math.min(SCORE.evidenceMax, c.required_evidence.length * SCORE.evidencePerItem)} + 照合 ${SCORE.link} + 検証 ${Math.min(SCORE.calculationMax, c.analysis_tasks.length * SCORE.calculationPerItem)} + 断片 ${Math.min(SCORE.fragmentMax, c.correct_fragments.length * SCORE.fragmentPerItem)}） |`,
  );
  L.push(`| 到達可能な最高点 | **${a.bestScore}** / 100 |`);
  L.push(`| 寄り道の許容 | 最小コストに加えて外れ資料を ${a.tolerated} 件まで開いてもクリア可能 |`);
  L.push('');
  if (a.detours.length > 0) {
    L.push('外れ資料を 1 件だけ開いた場合（最小コスト経路 + その 1 件）:');
    L.push('');
    L.push('| 外れ資料 | コスト | 残予算 | クリア | その時の最高点 |');
    L.push('| --- | --- | --- | --- | --- |');
    for (const x of a.detours) {
      L.push(
        `| \`${x.doc.id}\` ${cell(x.doc.title)} | ${x.doc.cost} | ${x.remaining} | ${x.clearable ? '可' : '**不可（詰み）**'} | ${x.score ?? '—'} |`,
      );
    }
    L.push('');
  }
  L.push('### 解説（debrief）');
  L.push('');
  L.push(`- 種明かし: ${c.debrief.explanation}`);
  L.push(`- 持ち帰り: ${c.debrief.takeaway}`);
  L.push('');
  L.push(END);
  return L.join('\n');
}

function renderV2(c) {
  const v2 = c.v2;
  const L = [
    START,
    `<!-- このブロックは scripts/generate_walkthrough.mjs が data/cases/${c.id}.json から生成します。直接編集しないでください。 -->`,
    '',
    '## 自動生成: V2の根拠・操作・振り返り',
    '',
    '### 基本情報',
    '',
    `- 事件: ${c.id} ${c.title}`,
    `- 改訂: ${v2.revision} / 方式: ${v2.modes.join(', ')}`,
    `- 調査予算: ${c.budget}`,
    '- 固定100点、計算入力、唯一の見出し順序は用いない。事実整合・根拠充足・操作完了を、判断や実験の反応と区別する。',
    '',
    '### 資料一覧',
    '',
    '| ID | コスト | タイトル | 本文 |',
    '| --- | ---: | --- | --- |',
  ];
  for (const d of c.documents)
    L.push(`| ${d.id} | ${d.cost} | ${cell(d.title)} | ${cell(d.content)} |`);
  L.push('', '### 情報解読: 妥当な解釈と事実誤認', '');
  for (const task of v2.decoding) {
    L.push(
      `#### ${task.id}: ${task.prompt}`,
      '',
      '| 選択 | 事実区分 | 整合 | 根拠 | 説明 |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const option of task.options)
      L.push(
        `| ${cell(option.text)} | ${option.status} | ${option.accepted ? '根拠付きで成立' : '資料と不整合'} | ${option.evidence.join(', ')} | ${cell(option.reason)} |`,
      );
    L.push('');
  }
  L.push('### 根拠グラフと代替経路', '', v2.graph.prompt, '');
  v2.graph.paths.forEach((path, i) =>
    L.push(
      `${i + 1}. ${path.map((edge) => `${edge.from} → ${edge.to} (${edge.relation})`).join(' / ')}`,
    ),
  );
  const paths = requiredDocumentPaths(c);
  L.push(
    '',
    '### 予算内で到達する資料集合',
    '',
    '| 経路 | 必要資料（解読・グラフ・開示） | コスト | 残予算 |',
    '| --- | --- | ---: | ---: |',
  );
  paths.forEach((path, i) => {
    const cost = path.reduce((sum, id) => sum + docById(c, id).cost, 0);
    L.push(`| ${i + 1} | ${path.join(', ')} | ${cost} | ${c.budget - cost} |`);
  });
  L.push(
    '',
    '資料は開いたあと証拠として採用する。最安経路だけを唯一の正解にしない。初回反応・方針の記録前は追加資料が封じられるため、先に公開資料から初回判断を記録する。',
  );
  if (v2.experiment) {
    const e = v2.experiment;
    L.push(
      '',
      '### 心理実験: 初回 → 比較 → 更新',
      '',
      e.prompt,
      '',
      '| 条件 | 提示 |',
      '| --- | --- |',
    );
    for (const condition of e.conditions)
      L.push(`| ${cell(condition.label)} (${condition.id}) | ${cell(condition.prompt)} |`);
    L.push(
      '',
      `- 共通選択肢: ${e.choices.map((choice) => `${choice.id}: ${choice.text}`).join(' / ')}`,
      `- 初回を記録した後に開く資料: ${e.revealDocuments.join(', ')}`,
      `- 比較の問い: ${e.comparisonPrompt}`,
      `- 限界・解説: ${e.explanation}`,
      '- 初回と更新後の両反応を保存し、判断維持・変更のどちらでも比較を完了できる。一回の反応から個人特性を判定しない。',
    );
  }
  if (v2.decision) {
    const d = v2.decision;
    L.push(
      '',
      '### 意思決定: 目的・制約・別方針',
      '',
      d.prompt,
      `- 目的: ${d.objectives.map((goal) => `${goal.id}: ${goal.text}`).join(' / ')}`,
      `- 利用可能な資源: ${d.resources}`,
      `- 初回の後に開く資料: ${d.revealDocuments.join(', ')}`,
      `- 更新の問い: ${d.updatePrompt}`,
      '',
      '| 方針 | 費用 | 条件付き結果 | トレードオフ |',
      '| --- | ---: | --- | --- |',
    );
    for (const option of d.options)
      L.push(
        `| ${option.id}: ${cell(option.text)} | ${option.cost} | ${cell(option.outcome)} | ${cell(option.tradeoff)} |`,
      );
    L.push(
      '',
      '支持資料・反証・前提・理由を記録し、追加情報後に方針を維持または更新する。保留も方針。結果の幸不幸で判断を正誤化せず、未選択の結果は反実仮想として区別する。',
    );
  }
  L.push(
    '',
    '### 報告と留保',
    '',
    v2.reportPrompt,
    '',
    '主張と未確認事項を分けて記録する。自由文の自動正誤判定はしない。根拠不足や事実誤認は、選んだ方針・実験反応とは別の観点で確認する。',
    '',
    '### 振り返り',
    '',
    `- 事件の説明: ${c.debrief.explanation}`,
    `- 持ち帰り: ${c.debrief.takeaway}`,
    '',
    END,
  );
  return L.join('\n');
}

function template(c) {
  return [
    `# ${c.id} 攻略・答え合わせ: ${c.title}`,
    '',
    '> 内部用。ネタバレを含む。リリース成果物に含めない。使い方は `README.md` を参照。',
    '',
    renderGenerated(c),
    '',
    '## 推奨調査順序',
    '',
    '（手書き）',
    '',
    '## コスト最小値での到達手順と最終スコア',
    '',
    '（手書き）',
    '',
    '## 別解の検討',
    '',
    '（手書き）',
    '',
    '## 詰みパターン',
    '',
    '（手書き）',
    '',
    '## 編集者メモ',
    '',
    '（手書き）',
    '',
  ].join('\n');
}

function embed(existing, generated, id) {
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s < 0 || e < 0 || e < s) {
    throw new Error(`${id}.md: マーカー ${START} / ${END} が見つかりません`);
  }
  return existing.slice(0, s) + generated + existing.slice(e + END.length);
}

function main() {
  const cases = loadCases();
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  let stale = 0;
  for (const c of cases) {
    const path = join(OUT_DIR, `${c.id}.md`);
    const generated = renderGenerated(c);
    const next = existsSync(path)
      ? embed(readFileSync(path, 'utf8'), generated, c.id)
      : template(c);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current === next) {
      console.log(`unchanged ${path}`);
      continue;
    }
    if (checkMode) {
      console.error(`stale     ${path}`);
      stale += 1;
    } else {
      writeFileSync(path, next, 'utf8');
      console.log(`${current === null ? 'created ' : 'updated '} ${path}`);
    }
  }
  if (checkMode && stale > 0) {
    console.error(`${stale} 件が古いです。npm run walkthrough を実行してください。`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
