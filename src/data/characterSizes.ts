import type { CharacterId } from './assets';

/**
 * キャラクター画像の実寸（px）。`<img width height>` に渡して CLS（レイアウトずれ）を防ぐ。
 *
 * 値は `assets.manifest.json` の `size` と一致させる（`characterSizes.test.ts` が検証）。
 * 画像を差し替えたら `python3 scripts/validate_assets.py` でマニフェストを更新し、ここも直す。
 * 画像そのものをコードから再生成・加工することはしない。
 */
export type ImageSize = readonly [width: number, height: number];

/** `poses/*.png` の実寸。各キャラのポーズはすべて同寸。 */
export const CHARACTER_POSE_SIZES = {
  shinobu: [1086, 1448],
  mega: [1536, 2048],
  kuro: [1536, 2048],
  harada: [1536, 2048],
} as const satisfies Record<CharacterId, ImageSize>;

/** `reactions/*.png` の実寸。全キャラ・全状態で共通。 */
export const CHARACTER_REACTION_SIZE: ImageSize = [1024, 1024];

/** `effects/reactions/*.png` の実寸（SVG も同じ viewBox）。 */
export const EFFECT_REACTION_SIZE: ImageSize = [120, 120];
