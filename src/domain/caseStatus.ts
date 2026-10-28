import type { CaseData, CaseProgress, Difficulty } from './types';

export type CaseStatus = 'new' | 'investigating' | 'draft' | 'published' | 'solved';

/** 事件一覧に出す進行状態。保存データだけから決まる純粋関数。 */
export function caseStatus(
  caseId: string,
  progress: CaseProgress | undefined,
  finished: Record<string, boolean>,
): CaseStatus {
  if (finished[caseId]) return 'solved';
  if (!progress) return 'new';
  if (progress.published) return 'published';
  if (progress.v2?.report.claim.trim() || progress.v2?.report.uncertainty.trim()) return 'draft';
  if (
    progress.v2?.experiment?.initialChoice ||
    progress.v2?.decisions.length ||
    Object.keys(progress.v2?.decoding ?? {}).length > 0
  )
    return 'investigating';
  if (progress.article.length > 0) return 'draft';
  if (progress.opened.length > 0) return 'investigating';
  return 'new';
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  new: '未着手',
  investigating: '調査中',
  draft: '記事作成中',
  published: '提出済み',
  solved: '解決',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  NORMAL: '標準',
  HARD: '難関',
  EXPERT: '最難関',
};

/** 難易度を 1〜3 の目盛りに。表示用。 */
export function difficultyLevel(difficulty: Difficulty): 1 | 2 | 3 {
  return difficulty === 'NORMAL' ? 1 : difficulty === 'HARD' ? 2 : 3;
}

/** 「前回の続き」に使う事件。進行中のものがあればそれ、なければ未解決の先頭。 */
export function continueCaseId(
  cases: CaseData[],
  activeId: string,
  progress: Record<string, CaseProgress>,
  finished: Record<string, boolean>,
): string | undefined {
  const active = progress[activeId];
  if (active && caseStatus(activeId, active, finished) !== 'solved') return activeId;
  const inProgress = cases.find((c) => {
    const s = caseStatus(c.id, progress[c.id], finished);
    return s === 'investigating' || s === 'draft' || s === 'published';
  });
  if (inProgress) return inProgress.id;
  return cases.find((c) => !finished[c.id])?.id;
}
