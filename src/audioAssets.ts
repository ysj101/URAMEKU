export const SOUND_FILES = [
  'paper-flip',
  'paper-place',
  'stamp',
  'evidence-pin',
  'evidence-link',
  'discovery',
  'correct',
  'incorrect',
  'ui-tap',
  'case-complete',
  'menu-open',
] as const;
export type GameSound = (typeof SOUND_FILES)[number];
export function soundUrl(id: GameSound, base = '/') {
  return `${base.replace(/\/$/, '')}/assets/audio/${id}.wav`;
}
// Call play() only after an explicit user gesture. Respect mute and reduced-motion settings.
