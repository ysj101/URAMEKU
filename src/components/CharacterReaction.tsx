import { useState, type AnimationEvent } from 'react';
import { effectReaction, type CharacterId, type EffectReactionName } from '../data/assets';
import { EFFECT_REACTION_SIZE } from '../data/characterSizes';
import { effectLabel } from './characterLabels';
import { useReducedMotion } from '../app/useReducedMotion';
import { CharImage, type CharImageProps } from './CharImage';

/**
 * 表情状態の演出（MVP-035）。
 *
 * 原画（`pose`、既定は idle。または C-2 承認済みの `reaction` 補助状態）の上に
 * `effects/reactions/` の記号（汗・ひらめき等、収録されている 6 種のみ）を重ねる。
 * 顔そのものは差し替えない＝別人化しない。
 *
 * 記号は出現時に「ぽん」と現れる（transform / opacity のみ）。reduced motion のときは
 * 演出クラスを付けず、最終状態を即時表示する。
 * 読み上げは枠全体を 1 枚の画像として扱い、「キャラ名（記号の意味）」を aria-label にする。
 */
export type EffectPlacement = 'top-right' | 'top-left';

export type CharacterReactionProps<C extends CharacterId = CharacterId> = Omit<
  CharImageProps<C>,
  'alt'
> & {
  effect: EffectReactionName;
  /** 記号の位置。既定は右上 */
  placement?: EffectPlacement;
  /** false にすると出現演出を行わない */
  animate?: boolean;
  /** aria-label の上書き */
  label?: string;
};

export function CharacterReaction<C extends CharacterId>({
  effect,
  placement = 'top-right',
  animate = true,
  label,
  className,
  ...image
}: CharacterReactionProps<C>) {
  const reduced = useReducedMotion();
  const animated = animate && !reduced;
  const [animating, setAnimating] = useState(animated);

  const effectClasses = ['char-reaction__effect'];
  if (animated) {
    effectClasses.push('motion-effect-pop');
    if (animating) effectClasses.push('is-animating');
  }

  const handleAnimationEnd = (event: AnimationEvent<HTMLImageElement>) => {
    if (event.target === event.currentTarget) setAnimating(false);
  };

  const classes = ['char-reaction', `char-reaction--${placement}`];
  if (className) classes.push(className);

  return (
    <span
      className={classes.join(' ')}
      role="img"
      aria-label={label ?? effectLabel(image.character, effect)}
      data-effect={effect}
      data-animated={animated ? 'true' : 'false'}
    >
      <CharImage {...(image as CharImageProps<C>)} alt="" />
      <img
        className={effectClasses.join(' ')}
        src={effectReaction(effect, 'svg')}
        alt=""
        width={EFFECT_REACTION_SIZE[0]}
        height={EFFECT_REACTION_SIZE[1]}
        decoding="async"
        draggable={false}
        onAnimationEnd={animated ? handleAnimationEnd : undefined}
      />
    </span>
  );
}
