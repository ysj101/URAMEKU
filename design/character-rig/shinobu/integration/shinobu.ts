export type ShinobuPose = 'idle' | 'point' | 'inspect' | 'explain';
export const SHINOBU_POSES: Record<ShinobuPose, string> = {
  idle: '/characters/shinobu/poses/shinobu_idle.png',
  point: '/characters/shinobu/poses/shinobu_point.png',
  inspect: '/characters/shinobu/poses/shinobu_inspect.png',
  explain: '/characters/shinobu/poses/shinobu_explain.png'
};
export const SHINOBU_INTRINSIC_SIZE = { width: 1086, height: 1448 } as const;
