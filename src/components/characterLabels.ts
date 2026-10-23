import type { CharacterId, CharacterPose, EffectReactionName, Reaction } from '../data/assets';
import { UI } from '../data/ui';

/** 原画の alt 文言: 「キャラ名（状態）」。文言は data/ui/ja.json の characters.* から取る。 */
export function characterAlt(
  character: CharacterId,
  state: { pose: CharacterPose } | { reaction: Reaction },
): string {
  const name = UI.characters.names[character];
  const label =
    'pose' in state ? UI.characters.poses[state.pose] : UI.characters.reactions[state.reaction];
  return `${name}（${label}）`;
}

/** 記号を重ねた状態の読み上げ文言: 「キャラ名（記号の意味）」。 */
export function effectLabel(character: CharacterId, effect: EffectReactionName): string {
  return `${UI.characters.names[character]}（${UI.characters.effects[effect]}）`;
}
