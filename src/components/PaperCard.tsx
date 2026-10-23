import { useState, type AnimationEvent, type HTMLAttributes, type ReactNode } from 'react';
import { useReducedMotion } from '../app/useReducedMotion';

/**
 * 紙片の共通ラッパー（MVP-038）。
 *
 * `.paper-card`（motion.css）の見た目に、任意の出現演出を 1 つ付ける。
 * - enter="place": カードが机に置かれる（既定）
 * - enter="page":  紙をめくって現れる
 * - enter="none":  演出なし
 * reduced motion のときは演出クラスを付けず、最終状態を即時表示する。
 */
export type PaperCardEnter = 'place' | 'page' | 'none';
export type PaperCardTone = 'white' | 'aged' | 'note';

export interface PaperCardProps extends HTMLAttributes<HTMLDivElement> {
  enter?: PaperCardEnter;
  tone?: PaperCardTone;
  children?: ReactNode;
}

const ENTER_CLASS: Record<Exclude<PaperCardEnter, 'none'>, string> = {
  place: 'motion-card-place',
  page: 'motion-page-turn',
};

export function PaperCard({
  enter = 'place',
  tone = 'white',
  className,
  children,
  onAnimationEnd,
  ...rest
}: PaperCardProps) {
  const reduced = useReducedMotion();
  const animated = enter !== 'none' && !reduced;
  const [animating, setAnimating] = useState(animated);

  const classes = ['paper-card'];
  if (tone !== 'white') classes.push(`paper-card--${tone}`);
  if (animated) {
    classes.push(ENTER_CLASS[enter]);
    if (animating) classes.push('is-animating');
  }
  if (className) classes.push(className);

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setAnimating(false);
    onAnimationEnd?.(event);
  };

  return (
    <div
      {...rest}
      className={classes.join(' ')}
      data-animated={animated ? 'true' : 'false'}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
