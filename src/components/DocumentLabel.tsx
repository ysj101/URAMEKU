import { propUrl } from '../data/assets';
import type { DocumentVisual } from '../domain/types';
import { VISUAL_LABEL, VISUAL_PROP, formatCaseId, formatDocumentNumber } from './documentVisuals';
import '../app/screens/document-label.css';

/**
 * 調査資料の識別ラベル（MVP-036）。
 *
 * 30 枚のサムネイル画像は同一テンプレートで、事件 ID は画像に含まれず、資料番号も
 * 極小の画像内文字でしか示されていない（docs/reviews/document-thumbnails-review.md）。
 * MVP_SPEC 12 章「画像内文字に依存せず、文章は HTML テキストとして描画する」に従い、
 * 事件 ID・資料 ID・資料種別・コストを **HTML テキスト** で表示する。
 *
 * 種別アイコンは `public/assets/props/<visual>.svg`（`propUrl`）を使う。
 * `data/schema/case.schema.json` の visual enum と `PROP_NAMES` は同じ 9 語なので
 * 1:1 で対応させる（documentVisuals.ts の VISUAL_PROP）。アイコンは装飾（aria-hidden）で、読み上げは
 * テキストだけで完結する。
 *
 * 組み込み先（DocumentTile / DocumentDialog）は MVP-022 と並行のため、本 PR では触らない。
 */

export interface DocumentLabelProps {
  caseId: string;
  /** 事件内の並び順（1 始まり）。サムネイル内の「DOCUMENT 0N」と一致させる */
  index: number;
  documentId: string;
  visual: DocumentVisual;
  cost: number;
  /** true のとき、種別アイコンを出さずテキストのみ */
  hideIcon?: boolean;
  className?: string;
}

export function DocumentLabel({
  caseId,
  index,
  documentId,
  visual,
  cost,
  hideIcon = false,
  className,
}: DocumentLabelProps) {
  const prop = VISUAL_PROP[visual];
  const kind = VISUAL_LABEL[visual];
  const costText = cost === 0 ? '無料' : `コスト ${cost}`;
  const classes = ['document-label', className].filter(Boolean).join(' ');

  return (
    <span className={classes} data-case={caseId} data-document={documentId} data-visual={visual}>
      {!hideIcon && (
        <img className="document-label__icon" src={propUrl(prop)} alt="" aria-hidden="true" />
      )}
      <span className="document-label__case">{formatCaseId(caseId)}</span>
      <span className="document-label__sep" aria-hidden="true">
        /
      </span>
      <span className="document-label__number">
        資料 {formatDocumentNumber(index)}
        <span className="document-label__id">（{documentId}）</span>
      </span>
      <span className="document-label__sep" aria-hidden="true">
        /
      </span>
      <span className="document-label__kind">{kind}</span>
      <span className="document-label__sep" aria-hidden="true">
        /
      </span>
      <span className="document-label__cost">{costText}</span>
    </span>
  );
}
