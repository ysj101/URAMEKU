import type { CSSProperties } from 'react';
import {
  characterPose,
  characterPortrait,
  type CharacterId,
  type Reaction,
} from './characterAssets';
export function AssetImage(props: {
  character: CharacterId;
  reaction?: Reaction;
  pose?: string;
  size?: number;
  base?: string;
  className?: string;
}) {
  const { character, reaction = 'idle', pose, size = 160, base = '/', className } = props;
  const src = pose
    ? characterPose(character, pose, base)
    : characterPortrait(character, reaction, base);
  const style: CSSProperties = {
    width: size,
    height: 'auto',
    objectFit: 'contain',
    display: 'block',
  };
  return (
    <img
      src={src}
      alt={`${character} ${pose || reaction}`}
      width={size}
      className={className}
      style={style}
      decoding="async"
    />
  );
}
