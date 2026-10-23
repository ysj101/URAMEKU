import { useEffect, useRef, useState, type AnimationEvent } from 'react';
import { assetUrl } from '../data/assets';
import { useReducedMotion } from '../app/useReducedMotion';
import { STAMP_LABEL, stampAssetPath, type StampKind } from './stampAssets';

/**
 * 判子を押す演出（MVP-038）。
 *
 * 画像は public/assets/ui/stamps/ に実在する 6 種のみ。
 * reduced motion のときは演出クラスを付けず、押された最終状態（傾き付き）を即時表示し、
 * `onSettled` もマウント直後に呼ぶ（音や次の UI の同期に使える）。
 */
export interface StampProps {
  kind: StampKind;
  /** false にするとマウント時の押下演出を行わない（すでに押されている判子の再表示など） */
  animate?: boolean;
  /** 演出が終わったとき（reduced 時は即時）に 1 回呼ぶ */
  onSettled?: () => void;
  /** alt の上書き。省略時は印字文言 */
  label?: string;
  className?: string;
}

export function Stamp({ kind, animate = true, onSettled, label, className }: StampProps) {
  const reduced = useReducedMotion();
  const animated = animate && !reduced;
  const [animating, setAnimating] = useState(animated);

  // onSettled の参照が変わっても再通知しないよう ref 経由で呼ぶ
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  });
  useEffect(() => {
    // 演出が無い（reduced または animate=false）ときは即時に「押された」扱い
    if (!animated) settledRef.current?.();
  }, [animated]);

  const handleAnimationEnd = (event: AnimationEvent<HTMLImageElement>) => {
    if (event.target !== event.currentTarget) return;
    setAnimating(false);
    onSettled?.();
  };

  const classes = ['stamp'];
  if (animated) {
    classes.push('motion-stamp-press');
    if (animating) classes.push('is-animating');
  }
  if (className) classes.push(className);

  return (
    <img
      className={classes.join(' ')}
      src={assetUrl(stampAssetPath(kind))}
      alt={label ?? STAMP_LABEL[kind]}
      data-stamp={kind}
      data-animated={animated ? 'true' : 'false'}
      draggable={false}
      onAnimationEnd={animated ? handleAnimationEnd : undefined}
    />
  );
}
