import { useEffect, useRef } from 'react';
import type { CaseDocument } from '../domain/types';

interface Props {
  document: CaseDocument | null;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}

export function DocumentDialog({ document: doc, pinned, onTogglePin, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (doc && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!doc && dialog.open) dialog.close();
  }, [doc]);

  return (
    <dialog ref={ref} aria-labelledby="dialog-title" onClose={onClose} onCancel={onClose}>
      <article className="document-popup">
        <div className="popup-head">
          <span>機密解除 / EDITORIAL ARCHIVE</span>
          <button type="button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </div>
        <h2 id="dialog-title">{doc?.title}</h2>
        <div id="dialog-content">{doc?.content}</div>
        <div className="popup-foot">
          <button type="button" className="btn primary" onClick={onTogglePin}>
            {pinned ? 'ボードから外す' : '証拠ボードに貼る'}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            戻る
          </button>
        </div>
      </article>
    </dialog>
  );
}
