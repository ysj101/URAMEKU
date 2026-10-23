/**
 * 判子画像の定義（MVP-038）。public/assets/ui/stamps/ に実在する 6 種のみ。
 * Stamp.tsx から分けているのは Fast Refresh のため（コンポーネント以外の export を置かない）。
 */
export type StampKind = 'accepted' | 'rejected' | 'draft' | 'perfect' | 'verified' | 'confidential';

/** 画像に印字されている文言（alt 用） */
export const STAMP_LABEL: Record<StampKind, string> = {
  accepted: '掲載可',
  rejected: '要再調査',
  draft: 'DRAFT',
  perfect: '特ダネ',
  verified: 'CHECKED',
  confidential: '社外秘',
};

export function stampAssetPath(kind: StampKind): string {
  return `ui/stamps/${kind}.svg`;
}
