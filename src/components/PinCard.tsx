import { forwardRef, type KeyboardEvent } from 'react';
import { PaperCard } from './PaperCard';
import { propUrl, uiIcon } from '../data/assets';
import type { CaseDocument } from '../domain/types';

/**
 * 証拠ボード上の 1 枚（MVP-023）。
 *
 * - カード本体はトグルボタン。押すと照合の選択（A / B）が切り替わる。
 * - ドラッグは使わない。タップ・クリック・Enter/Space で同じ操作ができる。
 * - Delete / Backspace でボードから外す（確認なし。再採用できるため）。
 * - 「外す」ボタンは常時表示（ホバーに依存しない）。
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
  /** 外せない理由の文言。外せるなら null */
  removeReason: string | null;
  onSelect: () => void;
  onRemove: () => void;
}

function slotLabel(slot: PinSlot | null): string {
  if (slot === 'A') return '選択中（A）';
  if (slot === 'B') return '照合候補（B）';
  return '未選択';
}

export const PinCard = forwardRef<HTMLButtonElement, PinCardProps>(function PinCard(
  { document: doc, index, slot, selectReason, removeReason, onSelect, onRemove },
  ref,
) {
  const canSelect = selectReason === null;
  const canRemove = removeReason === null;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (canRemove) onRemove();
    }
  };

  const handleSelect = () => {
    if (canSelect) onSelect();
  };

  const handleRemove = () => {
    if (canRemove) onRemove();
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
          onKeyDown={handleKeyDown}
        >
          <img className="evidence-card__prop" src={propUrl(doc.visual)} alt="" />
          <strong className="evidence-card__title">{doc.title}</strong>
          <span className="evidence-card__slot" aria-hidden="true">
            {slot ?? ''}
          </span>
        </button>
        {selectReason && <p className="evidence-card__reason">{selectReason}</p>}
        <button
          type="button"
          className="evidence-card__remove"
          aria-disabled={!canRemove}
          aria-label={`${doc.title} をボードから外す`}
          onClick={handleRemove}
        >
          <img src={uiIcon('trash')} alt="" aria-hidden="true" />
          ボードから外す
        </button>
      </PaperCard>
    </li>
  );
});
