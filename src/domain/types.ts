import type { V2Case, V2Progress } from './v2Types';
export type * from './v2Types';

/**
 * 事件データ（data/cases/*.json）と進行状態の型。
 * ここに DOM 依存のものを入れない。
 */

export type DocumentVisual =
  'advert' | 'report' | 'ledger' | 'news' | 'photo' | 'ticket' | 'clipping' | 'label' | 'receipt';

export type Difficulty = 'NORMAL' | 'HARD' | 'EXPERT';

export interface CaseDocument {
  id: string;
  title: string;
  content: string;
  /** 調査コスト。0 は無料で閲覧できる初期資料 */
  cost: number;
  visual: DocumentVisual;
}

export interface AnalysisTask {
  id: string;
  prompt: string;
  unit: string;
  expected: number;
  tolerance: number;
}

/**
 * 見出し断片の種別。docs/GAME_RULES.md 6 章の誤り型に対応する。
 * - correct: 正しい断片（correct_fragments に含まれる）
 * - overgeneralization: 理由なく全体に一般化
 * - misread-statistic: 統計の誤読（分母・指標の取り違え、相対変化の誇張など）
 * - causal-claim: 原因・結論の断定
 * - ignored-counter-evidence: 反対資料の無視
 * - unverifiable: 資料からは検証できない主張
 * - other: 上記に当てはまらない誤り
 */
export type FragmentKind =
  | 'correct'
  | 'overgeneralization'
  | 'misread-statistic'
  | 'causal-claim'
  | 'ignored-counter-evidence'
  | 'unverifiable'
  | 'other';

export const FRAGMENT_KINDS: readonly FragmentKind[] = [
  'correct',
  'overgeneralization',
  'misread-statistic',
  'causal-claim',
  'ignored-counter-evidence',
  'unverifiable',
  'other',
];

export interface HeadlineFragment {
  id: string;
  text: string;
  /** 誤り型。correct_fragments に含まれる断片は 'correct'、それ以外は 'correct' 以外 */
  kind?: FragmentKind;
  /** その断片が誤り（または正しい）である理由。1 文 */
  reason?: string;
  /** reason の根拠となる資料 ID（documents に存在すること） */
  evidence?: string[];
}

export interface Debrief {
  explanation: string;
  takeaway: string;
}

export interface CaseData {
  schemaVersion?: 2;
  v2?: V2Case;
  id: string;
  title: string;
  bias: string;
  difficulty: Difficulty;
  estimated_time: string;
  intro: string;
  budget: number;
  documents: CaseDocument[];
  required_evidence: string[];
  required_link: [string, string] | string[];
  /** 何を突き合わせる照合か（資料名は書かない。証拠ボードと記事画面に表示） */
  link_prompt: string;
  analysis_tasks: AnalysisTask[];
  headline_fragments: HeadlineFragment[];
  correct_fragments: string[];
  debrief: Debrief;
  disclaimer: string;
}

/** 1 事件ぶんの進行状態。保存対象。 */
export interface CaseProgress {
  v2?: V2Progress;
  /** 閲覧済み資料 ID（閲覧順） */
  opened: string[];
  /** 証拠ボードに採用した資料 ID */
  pinned: string[];
  /** 照合のために選択中の資料 ID（最大 2） */
  chosenLink: string[];
  /** 数値検証メモの入力値（文字列のまま保持し、評価時に解釈する） */
  calculations: Record<string, string>;
  /** 組み立て中の見出し断片 ID（順序あり、最大 3） */
  article: string[];
  /** 提出済みか */
  published: boolean;
  /** 解説と正解を公開したか */
  revealed: boolean;
}

export const ARTICLE_LENGTH = 3;
export const LINK_SIZE = 2;
