/** データ参照のみ。UI状態による容姿の再生成を行わない */
export type CharacterId = 'shinobu' | 'mega' | 'kuro' | 'harada';
export type Reaction = 'idle' | 'happy' | 'surprised' | 'thinking' | 'worried';
export type ShinobuPose = 'idle' | 'point' | 'inspect' | 'explain';
export const CHARACTER_IDS: CharacterId[] = ['shinobu', 'mega', 'kuro', 'harada'];
const path = (s: string, base = '/') => `${base.replace(/\/$/, '')}/assets/${s}`;
export function characterPortrait(id: CharacterId, state: Reaction = 'idle', base = '/') {
  return path(`characters/${id}/reactions/${state}.png`, base);
}
export function characterIcon(
  id: CharacterId,
  state: Reaction = 'idle',
  size: 64 | 128 | 256 | 512 = 256,
  base = '/',
) {
  return path(`characters/${id}/icons/${state}-${size}.png`, base);
}
export function characterPose(id: CharacterId, pose: string = 'idle', base = '/') {
  if (id !== 'shinobu' && pose !== 'idle') throw new Error(`Pose unavailable for ${id}: ${pose}`);
  if (id === 'shinobu' && !['idle', 'point', 'inspect', 'explain'].includes(pose))
    throw new Error(`Pose unavailable for ${id}: ${pose}`);
  return path(`characters/${id}/poses/${pose}.png`, base);
}
