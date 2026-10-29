import type { TutorialStep } from '../data/assets';

/**
 * 遊び方の手順番号 → 画面モックの場面。TutorialScene と TutorialScreen が共有する。
 * V2 の流れ（資料の読み取り → 予算と順番 → 文と証拠の記録 → ミニ実験 → 意思決定 → 報告）に対応する。
 */
export const TUTORIAL_SCENES = [
  'document-source',
  'desk-budget',
  'board-link',
  'experiment',
  'decision',
  'report',
] as const;
export type TutorialScene = (typeof TUTORIAL_SCENES)[number];

export function sceneForStep(step: TutorialStep): TutorialScene {
  return TUTORIAL_SCENES[step - 1] as TutorialScene;
}
