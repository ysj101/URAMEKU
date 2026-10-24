#!/usr/bin/env node
/**
 * 利用者テスト記録（qa/user-tests/*.json）の集計（MVP-044）。Node 標準モジュールのみ使用。
 *
 *   node scripts/summarize_user_tests.mjs                 # Markdown 表を標準出力へ
 *   node scripts/summarize_user_tests.mjs --json          # 機械可読 JSON
 *   node scripts/summarize_user_tests.mjs --dir <path>    # 別ディレクトリ（例: qa/user-tests/examples）
 *
 * 対象: 指定ディレクトリ直下の *.json。`session-template.json` と `_` 始まりは除外。サブディレクトリは読まない。
 * 検査: 必須フィールド・列挙値を確認し、自由記述に参加者の人格・能力評価に見える語が
 *       含まれていれば error として終了コード 1（AGENTS.md / docs/CONTENT_POLICY.md）。
 * 出力: 完走率（ケース別、助け舟なし完走率）、所要時間（平均・中央値）、楽しさ、理解度、
 *       ミス後の次の手、可読性、詰まり箇所の頻度（画面別 / 画面×操作別 / 種別 / 重大度）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = join(ROOT, 'qa', 'user-tests');
const TARGET_PARTICIPANTS = 5;
const PRIMARY_CASE = 'case-01';

const ENUMS = {
  'device.type': ['smartphone', 'tablet', 'pc'],
  'device.input': ['touch', 'mouse', 'keyboard'],
  'session.ended_reason': ['finished', 'time_up', 'participant_stopped', 'bug'],
  'cases[].case_id': ['tutorial', 'case-01', 'case-02', 'case-03', 'case-04', 'case-05'],
  'cases[].completed': ['yes', 'no', 'skipped'],
  'cases[].help_given[].condition': ['stuck_3min', 'dead_end_2min', 'bug', 'participant_request'],
  'stuck_points[].screen': [
    'home',
    'cases',
    'tutorial',
    'intro',
    'desk',
    'document',
    'board',
    'calc',
    'article',
    'result',
    'encyclopedia',
    'settings',
  ],
  'stuck_points[].kind': ['rule_unclear', 'ui_unclear', 'content_unclear', 'reasoning_hard', 'bug'],
  'stuck_points[].severity': ['blocks_completion', 'misleads', 'unpleasant', 'preference'],
  'stuck_points[].resolved_by': ['self', 'hint', 'observer', 'gave_up'],
  'understanding.explained_in_own_words': ['yes', 'partial', 'no'],
  'after_mistake.had_next_idea': ['yes', 'partial', 'no', 'not_applicable'],
};

/** 自由記述に混ざってはいけない、参加者の人格・能力評価に見える語（簡易リスト） */
const FORBIDDEN_IN_FREE_TEXT = [
  { re: /性格|人格|気質|体質/, note: '参加者の性格・人格への言及' },
  {
    re: /(判断力|能力|知能|理解力|集中力|注意力|IQ|頭)(が|は|の)?(低|高|ない|弱|強|不足|悪|良|鈍|速|遅)/,
    note: '参加者の能力評価',
  },
  {
    re: /バイアスが(強|弱|ある|ない)|に(陥|はま)りやすい(人|タイプ)|(かかって|陥って)(いる|いた)/,
    note: '参加者へのバイアス断定',
  },
  { re: /向いて(い)?な|センスが|勘が(鈍|悪|良|いい)/, note: '適性の評価' },
  { re: /(理解|飲み込み|のみこみ)が(遅|速|早|悪|良)/, note: '理解の速さの評価' },
  { re: /\b(diagnos|personality|stupid|dumb|smart|intelligen)/i, note: '英語の人格・能力評価' },
];
const FREE_TEXT_FIELDS = [
  'fun_comment',
  'understanding.quote',
  'after_mistake.note',
  'readability.note',
  'free_text',
  'observer_notes',
];
/** 個人情報らしきもの（氏名は検出しきれないため、連絡先・年齢・性別のみ） */
const PII_IN_ANY_TEXT = [
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, note: 'メールアドレス' },
  { re: /0\d{1,4}-\d{1,4}-\d{3,4}/, note: '電話番号' },
  { re: /\d{2}\s*(歳|代)(?![目])/, note: '年齢・年代' },
  { re: /(男性|女性|男の子|女の子)/, note: '性別' },
];

export function loadSessions(dir = DEFAULT_DIR) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((f) => f.endsWith('.json') && f !== 'session-template.json' && !f.startsWith('_'))
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort()
    .map((f) => ({ file: f, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function checkEnum(problems, file, key, value) {
  const allowed = ENUMS[key];
  if (allowed && !allowed.includes(value)) {
    problems.push({
      file,
      severity: 'error',
      msg: `${key} が不正: ${JSON.stringify(value)}（許容: ${allowed.join(' / ')}）`,
    });
  }
}

function scanText(problems, file, field, text, rules, label) {
  if (typeof text !== 'string' || !text) return;
  for (const { re, note } of rules) {
    const m = text.match(re);
    if (m) {
      problems.push({
        file,
        severity: 'error',
        msg: `${field} に${label}: 「${m[0]}」（${note}）。画面・操作・引用のみ記録する`,
      });
    }
  }
}

export function validateSession({ file, data }) {
  const problems = [];
  const err = (msg) => problems.push({ file, severity: 'error', msg });
  const warn = (msg) => problems.push({ file, severity: 'warn', msg });

  if (data.schema_version !== 1) err(`schema_version は 1（実際: ${data.schema_version}）`);
  if (!/^P\d{2,}$/.test(String(data.participant ?? '')))
    err(`participant は P01 形式（実際: ${data.participant}）`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date ?? '')))
    err(`date は YYYY-MM-DD（実際: ${data.date}）`);
  if (get(data, 'consent.verbal') !== true)
    err('consent.verbal が true でない（口頭同意なしの記録は集計しない）');
  if (!get(data, 'build.commit')) warn('build.commit が空');
  checkEnum(problems, file, 'device.type', get(data, 'device.type'));
  checkEnum(problems, file, 'device.input', get(data, 'device.input'));
  checkEnum(problems, file, 'session.ended_reason', get(data, 'session.ended_reason'));
  if (typeof get(data, 'session.total_minutes') !== 'number')
    err('session.total_minutes が数値でない');
  if (typeof data.ran_without_verbal_help !== 'boolean')
    err('ran_without_verbal_help が boolean でない');
  if (!(Number.isInteger(data.fun) && data.fun >= 1 && data.fun <= 5))
    err(`fun は 1〜5 の整数（実際: ${data.fun}）`);
  checkEnum(
    problems,
    file,
    'understanding.explained_in_own_words',
    get(data, 'understanding.explained_in_own_words'),
  );
  checkEnum(
    problems,
    file,
    'after_mistake.had_next_idea',
    get(data, 'after_mistake.had_next_idea'),
  );
  if (typeof get(data, 'readability.paper_decoration_issue') !== 'boolean')
    err('readability.paper_decoration_issue が boolean でない');

  const cases = Array.isArray(data.cases) ? data.cases : [];
  if (!Array.isArray(data.cases)) err('cases が配列でない');
  if (!cases.some((c) => c.case_id === PRIMARY_CASE))
    warn(`cases に ${PRIMARY_CASE} がない（完走率に no として数える）`);
  for (const c of cases) {
    checkEnum(problems, file, 'cases[].case_id', c.case_id);
    checkEnum(problems, file, 'cases[].completed', c.completed);
    if (typeof c.minutes !== 'number') err(`cases[${c.case_id}].minutes が数値でない`);
    for (const h of c.help_given ?? []) {
      checkEnum(problems, file, 'cases[].help_given[].condition', h.condition);
      scanText(
        problems,
        file,
        `cases[${c.case_id}].help_given[].said`,
        h.said,
        FORBIDDEN_IN_FREE_TEXT,
        '評価語',
      );
    }
  }
  const helpCount = cases.reduce((s, c) => s + (c.help_given?.length ?? 0), 0);
  if (data.ran_without_verbal_help === true && helpCount > 0) {
    err(`ran_without_verbal_help が true だが help_given が ${helpCount} 件ある`);
  }

  const stuck = Array.isArray(data.stuck_points) ? data.stuck_points : [];
  if (!Array.isArray(data.stuck_points)) err('stuck_points が配列でない');
  stuck.forEach((s, i) => {
    if (!/^\d{2}:\d{2}$/.test(String(s.time ?? '')))
      err(`stuck_points[${i}].time は MM:SS（実際: ${s.time}）`);
    checkEnum(problems, file, 'cases[].case_id', s.case_id);
    checkEnum(problems, file, 'stuck_points[].screen', s.screen);
    checkEnum(problems, file, 'stuck_points[].kind', s.kind);
    checkEnum(problems, file, 'stuck_points[].severity', s.severity);
    checkEnum(problems, file, 'stuck_points[].resolved_by', s.resolved_by);
    if (!s.action) err(`stuck_points[${i}].action が空`);
    if (!s.observation) warn(`stuck_points[${i}].observation が空`);
    scanText(
      problems,
      file,
      `stuck_points[${i}].observation`,
      s.observation,
      FORBIDDEN_IN_FREE_TEXT,
      '評価語',
    );
  });

  for (const f of FREE_TEXT_FIELDS)
    scanText(problems, file, f, get(data, f), FORBIDDEN_IN_FREE_TEXT, '評価語');
  for (const [k, v] of Object.entries(data.interview ?? {}))
    scanText(problems, file, `interview.${k}`, v, FORBIDDEN_IN_FREE_TEXT, '評価語');
  // 個人情報: 全文字列を走査
  const walk = (v, path) => {
    if (typeof v === 'string')
      scanText(problems, file, path, v, PII_IN_ANY_TEXT, '個人情報らしき記述');
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(data, '');
  return problems;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const countBy = (xs, key) => {
  const m = new Map();
  for (const x of xs) {
    const k = key(x);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

export function summarize(sessions) {
  const n = sessions.length;
  const data = sessions.map((s) => s.data);

  const caseIds = ENUMS['cases[].case_id'];
  const byCase = caseIds
    .map((id) => {
      const rows = data.map((d) => (d.cases ?? []).find((c) => c.case_id === id) ?? null);
      const attempted = rows.filter((c) => c && c.completed !== 'skipped');
      const completed = attempted.filter((c) => c.completed === 'yes');
      const noHelp = completed.filter((c) => !(c.help_given?.length > 0));
      const minutes = attempted.map((c) => c.minutes).filter((x) => typeof x === 'number');
      return {
        case_id: id,
        attempted: attempted.length,
        completed: completed.length,
        completed_without_help: noHelp.length,
        completion_rate: attempted.length ? completed.length / attempted.length : null,
        mean_minutes: mean(minutes),
        median_minutes: median(minutes),
        failed_publishes: attempted.reduce((s, c) => s + (c.failed_publishes ?? 0), 0),
        resets: attempted.reduce((s, c) => s + (c.reset_count ?? 0), 0),
        help_given: attempted.reduce((s, c) => s + (c.help_given?.length ?? 0), 0),
      };
    })
    .filter((r) => r.attempted > 0);

  // 完走 = PRIMARY_CASE を completed: yes（参加者単位。未挑戦は未完走として数える）
  const primaryDone = data.filter((d) =>
    (d.cases ?? []).some((c) => c.case_id === PRIMARY_CASE && c.completed === 'yes'),
  );
  const primaryDoneNoHelp = primaryDone.filter((d) => d.ran_without_verbal_help === true);

  const stuck = data.flatMap((d) =>
    (d.stuck_points ?? []).map((s) => ({ ...s, participant: d.participant })),
  );
  const groupStuck = (key) => {
    const groups = new Map();
    for (const s of stuck) {
      const k = key(s);
      const g = groups.get(k) ?? {
        key: k,
        count: 0,
        participants: new Set(),
        severities: new Map(),
        kinds: new Map(),
      };
      g.count++;
      g.participants.add(s.participant);
      g.severities.set(s.severity, (g.severities.get(s.severity) ?? 0) + 1);
      g.kinds.set(s.kind, (g.kinds.get(s.kind) ?? 0) + 1);
      groups.set(k, g);
    }
    return [...groups.values()]
      .map((g) => ({
        key: g.key,
        count: g.count,
        participants: g.participants.size,
        severities: Object.fromEntries(g.severities),
        kinds: Object.fromEntries(g.kinds),
      }))
      .sort(
        (a, b) =>
          b.participants - a.participants || b.count - a.count || a.key.localeCompare(b.key),
      );
  };

  const funs = data.map((d) => d.fun).filter((x) => typeof x === 'number');
  const totalMinutes = data
    .map((d) => get(d, 'session.total_minutes'))
    .filter((x) => typeof x === 'number');

  return {
    generated_from: sessions.map((s) => s.file),
    participants: n,
    target_participants: TARGET_PARTICIPANTS,
    devices: Object.fromEntries(countBy(data, (d) => get(d, 'device.type') ?? 'unknown')),
    session_minutes: { mean: mean(totalMinutes), median: median(totalMinutes) },
    primary_case: PRIMARY_CASE,
    completion: {
      completed: primaryDone.length,
      completed_without_help: primaryDoneNoHelp.length,
      rate: n ? primaryDone.length / n : null,
      rate_without_help: n ? primaryDoneNoHelp.length / n : null,
    },
    by_case: byCase,
    fun: {
      mean: mean(funs),
      median: median(funs),
      distribution: Object.fromEntries(
        [1, 2, 3, 4, 5].map((v) => [v, funs.filter((x) => x === v).length]),
      ),
    },
    understanding: Object.fromEntries(
      ENUMS['understanding.explained_in_own_words'].map((v) => [
        v,
        data.filter((d) => get(d, 'understanding.explained_in_own_words') === v).length,
      ]),
    ),
    after_mistake: Object.fromEntries(
      ENUMS['after_mistake.had_next_idea'].map((v) => [
        v,
        data.filter((d) => get(d, 'after_mistake.had_next_idea') === v).length,
      ]),
    ),
    ran_without_verbal_help: data.filter((d) => d.ran_without_verbal_help === true).length,
    readability_issues: data.filter((d) => get(d, 'readability.paper_decoration_issue') === true)
      .length,
    stuck: {
      total: stuck.length,
      by_screen: groupStuck((s) => s.screen),
      by_screen_action: groupStuck((s) => `${s.screen}/${s.action}`),
      by_kind: Object.fromEntries(countBy(stuck, (s) => s.kind)),
      by_severity: Object.fromEntries(countBy(stuck, (s) => s.severity)),
      by_resolution: Object.fromEntries(countBy(stuck, (s) => s.resolved_by)),
      blocking: stuck
        .filter((s) => s.severity === 'blocks_completion')
        .map((s) => ({
          participant: s.participant,
          time: s.time,
          case_id: s.case_id,
          screen: s.screen,
          action: s.action,
          kind: s.kind,
          observation: s.observation,
        })),
    },
  };
}

const pct = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`);
const num = (x, d = 1) => (x == null ? '-' : Number(x).toFixed(d));
const obj = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || '-';

export function toMarkdown(sum) {
  const L = [];
  L.push('# 利用者テスト集計');
  L.push('');
  L.push(
    `- 参加者: **${sum.participants} / ${sum.target_participants} 人**${sum.participants === 0 ? '（未実施）' : ''}`,
  );
  L.push(`- 端末: ${obj(sum.devices)}`);
  L.push(
    `- セッション所要時間: 平均 ${num(sum.session_minutes.mean)} 分 / 中央値 ${num(sum.session_minutes.median)} 分`,
  );
  L.push(`- 口頭補足なしで進められた人: ${sum.ran_without_verbal_help} / ${sum.participants}`);
  L.push(`- 紙の装飾による可読性の問題があった人: ${sum.readability_issues} / ${sum.participants}`);
  L.push('');
  L.push(`## 完走率（${sum.primary_case}）`);
  L.push('');
  L.push('| 指標 | 値 |');
  L.push('| --- | ---: |');
  L.push(
    `| 完走 | ${sum.completion.completed} / ${sum.participants}（${pct(sum.completion.rate)}） |`,
  );
  L.push(
    `| 助け舟なしで完走 | ${sum.completion.completed_without_help} / ${sum.participants}（${pct(sum.completion.rate_without_help)}） |`,
  );
  L.push('');
  L.push('## ケース別');
  L.push('');
  L.push(
    '| ケース | 挑戦 | 完走 | 助け舟なし完走 | 完走率 | 平均分 | 中央値分 | 不掲載回数 | リセット | 助け舟 |',
  );
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const r of sum.by_case) {
    L.push(
      `| ${r.case_id} | ${r.attempted} | ${r.completed} | ${r.completed_without_help} | ${pct(r.completion_rate)} | ${num(r.mean_minutes)} | ${num(r.median_minutes)} | ${r.failed_publishes} | ${r.resets} | ${r.help_given} |`,
    );
  }
  if (!sum.by_case.length) L.push('| - | 0 | 0 | 0 | - | - | - | 0 | 0 | 0 |');
  L.push('');
  L.push('## 楽しさ（1〜5）・理解・ミス後の次の手');
  L.push('');
  L.push('| 指標 | 値 |');
  L.push('| --- | --- |');
  L.push(`| 楽しさ 平均 / 中央値 | ${num(sum.fun.mean, 2)} / ${num(sum.fun.median)} |`);
  L.push(`| 楽しさ 分布 | ${obj(sum.fun.distribution)} |`);
  L.push(`| 理解（論点を自分の言葉で） | ${obj(sum.understanding)} |`);
  L.push(`| ミス後に次の手を言えた | ${obj(sum.after_mistake)} |`);
  L.push('');
  L.push(`## 詰まり箇所（計 ${sum.stuck.total} 件）`);
  L.push('');
  L.push(`- 種別: ${obj(sum.stuck.by_kind)}`);
  L.push(`- 重大度: ${obj(sum.stuck.by_severity)}`);
  L.push(`- 解決: ${obj(sum.stuck.by_resolution)}`);
  L.push('');
  L.push('### 画面別');
  L.push('');
  L.push('| 画面 | 件数 | 参加者数 | 重大度 | 種別 |');
  L.push('| --- | ---: | ---: | --- | --- |');
  for (const g of sum.stuck.by_screen)
    L.push(
      `| ${g.key} | ${g.count} | ${g.participants} | ${obj(g.severities)} | ${obj(g.kinds)} |`,
    );
  if (!sum.stuck.by_screen.length) L.push('| - | 0 | 0 | - | - |');
  L.push('');
  L.push('### 画面 × 操作別');
  L.push('');
  L.push('| 画面/操作 | 件数 | 参加者数 | 重大度 | 種別 |');
  L.push('| --- | ---: | ---: | --- | --- |');
  for (const g of sum.stuck.by_screen_action)
    L.push(
      `| ${g.key} | ${g.count} | ${g.participants} | ${obj(g.severities)} | ${obj(g.kinds)} |`,
    );
  if (!sum.stuck.by_screen_action.length) L.push('| - | 0 | 0 | - | - |');
  L.push('');
  L.push('### 完走を妨げた詰まり（Issue 起票候補）');
  L.push('');
  if (sum.stuck.blocking.length) {
    L.push('| 参加者 | 時刻 | ケース | 画面/操作 | 種別 | 観察 |');
    L.push('| --- | --- | --- | --- | --- | --- |');
    for (const b of sum.stuck.blocking) {
      L.push(
        `| ${b.participant} | ${b.time} | ${b.case_id} | ${b.screen}/${b.action} | ${b.kind} | ${String(
          b.observation ?? '',
        )
          .replace(/\|/g, '\\|')
          .replace(/\n/g, ' ')} |`,
      );
    }
  } else {
    L.push('なし');
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push(
    'この表はゲームの改善点を示すものであり、参加者を評価するものではない。起票は `.github/ISSUE_TEMPLATE/user-test-finding.md` を使う。',
  );
  return L.join('\n');
}

function main(argv) {
  const json = argv.includes('--json');
  const dirIdx = argv.indexOf('--dir');
  const dir = dirIdx >= 0 && argv[dirIdx + 1] ? resolve(ROOT, argv[dirIdx + 1]) : DEFAULT_DIR;

  let sessions;
  try {
    sessions = loadSessions(dir);
  } catch (e) {
    console.error(`読込エラー: ${e.message}`);
    return 1;
  }
  const problems = sessions.flatMap(validateSession);
  const errors = problems.filter((p) => p.severity === 'error');
  for (const p of problems) console.error(`[${p.severity}] ${p.file}: ${p.msg}`);
  if (errors.length) {
    console.error(
      `\n${errors.length} 件のエラー。記録を修正してから再実行する（qa/user-tests/README.md）。`,
    );
    return 1;
  }

  const sum = summarize(sessions);
  if (json) console.log(JSON.stringify(sum, null, 2));
  else console.log(toMarkdown(sum));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
