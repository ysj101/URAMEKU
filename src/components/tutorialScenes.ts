import type { TutorialStep } from '../data/assets';

/** 遊び方の手順番号 → 画面モックの場面。TutorialScene と TutorialScreen が共有する */
export const TUTORIAL_SCENES = [
  'desk-open',
  'desk-budget',
  'dialog-pin',
  'board-link',
  'memo-calc',
  'article-submit',
] as const;
export type TutorialScene = (typeof TUTORIAL_SCENES)[number];

export function sceneForStep(step: TutorialStep): TutorialScene {
  return TUTORIAL_SCENES[step - 1] as TutorialScene;
}
