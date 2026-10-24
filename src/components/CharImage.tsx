import type { ImgHTMLAttributes } from 'react';
import {
  characterPose,
  characterReaction,
  type CharacterId,
  type CharacterPose,
  type Reaction,
} from '../data/assets';
import { CHARACTER_POSE_SIZES, CHARACTER_REACTION_SIZE } from '../data/characterSizes';
import { characterAlt } from './characterLabels';
import '../app/screens/character.css';

/**
 * 承認済み原画を表示する唯一の入口（MVP-035）。
 *
 * - `pose`: `characters/<id>/poses/*.png`（原画）。収録されていない組み合わせ
 *   （メガ・クロ・ハラダの `point` など）は型エラー。
 * - `reaction`: `characters/<id>/reactions/*.png`（原画に記号を重ねた補助状態、C-2 承認済み）。
 * - 省略時は `pose="idle"`。
 *
 * 顔を再生成・差し替えることはしない。表情の「演出」は CharacterReaction で記号を重ねる。
 * `width/height` 属性は実寸（characterSizes.ts）を渡し、読み込み前のレイアウトずれを防ぐ。
 * 表示サイズは `size` か呼び出し側の CSS（例: `.case-mascot`）で決める。
 */
export type CharImageSize = 'sm' | 'md' | 'lg';

type Base<C extends CharacterId> = {
  character: C;
  /** 表示幅のプリセット。省略時は寸法クラスを付けない（呼び出し側 CSS に任せる） */
  size?: CharImageSize;
  /** alt の上書き。装飾として扱うときは "" */
  alt?: string;
  className?: string;
  /** 既定は lazy。ファーストビューの主役など、先読みしたいときは "eager" */
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading'];
};

export type CharImageProps<C extends CharacterId = CharacterId> = Base<C> &
  ({ pose?: CharacterPose<C>; reaction?: never } | { reaction: Reaction; pose?: never });

export function CharImage<C extends CharacterId>(props: CharImageProps<C>) {
  const { character, size, alt, className, loading = 'lazy' } = props;
  let src: string;
  let dimensions: readonly [number, number];
  let defaultAlt: string;
  if (props.reaction !== undefined) {
    src = characterReaction(character, props.reaction);
    dimensions = CHARACTER_REACTION_SIZE;
    defaultAlt = characterAlt(character, { reaction: props.reaction });
  } else {
    const pose: CharacterPose<C> = props.pose ?? ('idle' as CharacterPose<C>);
    src = characterPose(character, pose);
    dimensions = CHARACTER_POSE_SIZES[character];
    defaultAlt = characterAlt(character, { pose });
  }

  const classes = ['char-image'];
  if (size) classes.push(`char-image--${size}`);
  if (className) classes.push(className);

  return (
    <img
      className={classes.join(' ')}
      src={src}
      alt={alt ?? defaultAlt}
      width={dimensions[0]}
      height={dimensions[1]}
      loading={loading}
      decoding="async"
      draggable={false}
      data-character={character}
      data-state={props.reaction ?? props.pose ?? 'idle'}
    />
  );
}
