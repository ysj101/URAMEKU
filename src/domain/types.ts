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

export interface HeadlineFragment {
  id: string;
  text: string;
}

export interface Debrief {
  explanation: string;
  takeaway: string;
}

export interface CaseData {
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
  analysis_tasks: AnalysisTask[];
  headline_fragments: HeadlineFragment[];
  correct_fragments: string[];
  debrief: Debrief;
  disclaimer: string;
}

/** 1 事件ぶんの進行状態。保存対象。 */
export interface CaseProgress {
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
