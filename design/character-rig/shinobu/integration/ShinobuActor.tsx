import React from 'react';
import { SHINOBU_POSES, type ShinobuPose } from './shinobu';
export function ShinobuActor({ pose='idle', height=340, alt='シノブ', ...props }:
  { pose?: ShinobuPose; height?: number; alt?: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const { style, ...rest } = props;
  return <img src={SHINOBU_POSES[pose]} alt={alt} width={Math.round(height*1086/1448)} height={height}
    {...rest} style={{ objectFit:'contain', display:'block', ...style }} />;
}
