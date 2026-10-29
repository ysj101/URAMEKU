import { forwardRef } from 'react';
import { PaperCard } from './PaperCard';
import { propUrl, uiIcon } from '../data/assets';
import type { CaseDocument } from '../domain/types';

/**
 * 証拠ボード上の 1 枚（MVP-023）。
 *
 * - カード本体はトグルボタン。押すと照合の選択（A / B）が切り替わる。
 * - ドラッグは使わない。タップ・クリック・Enter/Space で同じ操作ができる。
 * - 読んだ資料は自動でボードに並ぶ（外す操作はない）。
 */
export type PinSlot = 'A' | 'B';

export interface PinCardProps {
  document: CaseDocument;
  /** ボード上の並び順（傾きの変化に使う） */
  index: number;
  /** 照合の選択スロット。未選択なら null */
  slot: PinSlot | null;
  /** 選択できない理由の文言。選択できるなら null */
  selectReason: string | null;
  onSelect: () => void;
}

function slotLabel(slot: PinSlot | null): string {
  if (slot === 'A') return '選択中（A）';
  if (slot === 'B') return '照合候補（B）';
  return '未選択';
}

export const PinCard = forwardRef<HTMLButtonElement, PinCardProps>(function PinCard(
  { document: doc, index, slot, selectReason, onSelect },
  ref,
) {
  const canSelect = selectReason === null;

  const handleSelect = () => {
    if (canSelect) onSelect();
  };

  const classes = ['evidence-card'];
  if (slot) classes.push('is-selected', `is-slot-${slot.toLowerCase()}`);
  if (!canSelect) classes.push('is-locked');

  return (
    <li className="evidence-card-wrap" data-index={index % 4}>
      <PaperCard enter="place" className={classes.join(' ')} data-document-id={doc.id}>
        <img className="evidence-card__pin" src={uiIcon('pin')} alt="" aria-hidden="true" />
        <button
          ref={ref}
          type="button"
          className="evidence-card__select"
          aria-pressed={slot !== null}
          aria-disabled={!canSelect}
          aria-label={`${doc.title}、${slotLabel(slot)}`}
          onClick={handleSelect}
        >
          <img className="evidence-card__prop" src={propUrl(doc.visual)} alt="" />
          <strong className="evidence-card__title">{doc.title}</strong>
          <span className="evidence-card__slot" aria-hidden="true">
            {slot ?? ''}
          </span>
        </button>
        {selectReason && <p className="evidence-card__reason">{selectReason}</p>}
      </PaperCard>
    </li>
  );
});
