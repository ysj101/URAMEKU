import type { PropName } from '../data/assets';
import type { DocumentVisual } from '../domain/types';

/**
 * 調査資料の種別（visual）と表示情報の対応表（MVP-036）。
 * DocumentLabel.tsx から分離しているのは、コンポーネント以外の export があると
 * Fast Refresh が効かなくなるため（Stamp.tsx / stampAssets.ts と同じ構成）。
 */

/** visual enum → props のファイル名。両者は同じ 9 語だが、対応表として明示しておく。 */
export const VISUAL_PROP = {
  advert: 'advert',
  ledger: 'ledger',
  receipt: 'receipt',
  report: 'report',
  clipping: 'clipping',
  news: 'news',
  photo: 'photo',
  ticket: 'ticket',
  label: 'label',
} as const satisfies Record<DocumentVisual, PropName>;

/** visual enum → 画面表示用の日本語種別名。 */
export const VISUAL_LABEL = {
  advert: '広告',
  ledger: '台帳',
  receipt: '決済記録',
  report: '報告書',
  clipping: '切り抜き',
  news: '記事',
  photo: '写真',
  ticket: '伝票',
  label: 'ラベル',
} as const satisfies Record<DocumentVisual, string>;

/** `case-01` → `CASE 01`。想定外の形式はそのまま大文字にする。 */
export function formatCaseId(caseId: string): string {
  const m = /^case-(\d+)$/.exec(caseId);
  const digits = m?.[1];
  return digits ? `CASE ${digits.padStart(2, '0')}` : caseId.toUpperCase();
}

/** 資料の並び順（1 始まり）を 2 桁に揃える。 */
export function formatDocumentNumber(index: number): string {
  return String(index).padStart(2, '0');
}
