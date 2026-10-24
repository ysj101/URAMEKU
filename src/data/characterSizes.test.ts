import { describe, expect, it } from 'vitest';
import {
  CHARACTER_IDS,
  CHARACTER_POSES,
  EFFECT_REACTION_NAMES,
  REACTIONS,
  characterPose,
  characterReaction,
  effectReaction,
} from './assets';
import { loadManifest, normalizeAssetPath } from './assetManifest';
import {
  CHARACTER_POSE_SIZES,
  CHARACTER_REACTION_SIZE,
  EFFECT_REACTION_SIZE,
} from './characterSizes';

function manifestSize(url: string): [number, number] | undefined {
  const rel = `public/assets/${normalizeAssetPath(url)}`;
  const entry = loadManifest().assets.find((a) => a.path === rel);
  expect(entry, `manifest entry for ${rel}`).toBeDefined();
  return entry?.size;
}

describe('characterSizes', () => {
  it('ポーズ画像の寸法定数がマニフェストと一致する', () => {
    for (const id of CHARACTER_IDS) {
      for (const pose of CHARACTER_POSES[id]) {
        expect(manifestSize(characterPose(id, pose))).toEqual([...CHARACTER_POSE_SIZES[id]]);
      }
    }
  });

  it('リアクション画像の寸法定数がマニフェストと一致する', () => {
    for (const id of CHARACTER_IDS) {
      for (const reaction of REACTIONS) {
        expect(manifestSize(characterReaction(id, reaction))).toEqual([
          ...CHARACTER_REACTION_SIZE,
        ]);
      }
    }
  });

  it('演出記号（PNG 版）の寸法定数がマニフェストと一致する', () => {
    for (const name of EFFECT_REACTION_NAMES) {
      expect(manifestSize(effectReaction(name, 'png'))).toEqual([...EFFECT_REACTION_SIZE]);
    }
  });
});
