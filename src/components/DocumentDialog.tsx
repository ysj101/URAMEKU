import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from 'react';
import {
  canPinDocument,
  canUnpinDocument,
  type PinRejectReason,
  type UnpinRejectReason,
} from '../domain/evidence';
import type { CaseData, CaseProgress } from '../domain/types';

interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  /** 開いている資料 ID。null なら閉じる */
  documentId: string | null;
  onTogglePin: (documentId: string) => void;
  onClose: () => void;
}

/** history.pushState に積む状態。popstate で見分けるための印 */
export interface DocumentHistoryState {
  doc: string;
}

const PIN_REASON: Record<PinRejectReason | UnpinRejectReason, string> = {
  published: '記事を提出済みのため、ボードは変更できません。取り下げると編集できます。',
  'not-opened': '閲覧していない資料は採用できません。',
  'already-pinned': 'この資料はすでにボードに貼られています。',
  'not-pinned': 'この資料はボードに貼られていません。',
  'unknown-document': 'この事件には存在しない資料です。',
};

/**
 * 資料の全文を表示するモーダル（MVP-022）。
 *
 * 閉じ方は 3 通り: 背景タップ、Esc（`cancel`）、ブラウザの戻る（`popstate`）。
 * 開くときに `history.pushState({ doc }, '')` を積み、閉じるボタン等では `history.back()` で
 * 状態を整合させる。ハッシュは変えないので `navigation.ts` のハッシュルートとは干渉しない。
 */
export function DocumentDialog({ caseData, progress, documentId, onTogglePin, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** 自分が history に状態を積んでいるか（二重に戻らないためのガード） */
  const pushedRef = useRef(false);
  /** 閉じる前にフォーカスがあった要素（元のタイル） */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const doc = documentId ? (caseData.documents.find((d) => d.id === documentId) ?? null) : null;
  const pinned = documentId ? progress.pinned.includes(documentId) : false;
  const check = documentId
    ? pinned
      ? canUnpinDocument(caseData, progress, documentId)
      : canPinDocument(caseData, progress, documentId)
    : null;

  /** 閉じる操作（ボタン・Esc・背景）。積んだ履歴を戻してから親に通知する */
  const requestClose = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
    onCloseRef.current();
  }, []);

  // 開閉と履歴の同期
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (doc) {
      if (!dialog.open) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      if (!pushedRef.current) {
        const state: DocumentHistoryState = { doc: doc.id };
        window.history.pushState(state, '');
        pushedRef.current = true;
      }
      headingRef.current?.focus();
      return;
    }
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) target.focus();
  }, [doc]);

  // ブラウザの戻るで閉じる
  useEffect(() => {
    if (!doc) return;
    const onPop = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [doc]);

  // 開いたままアンマウントされたら履歴を戻す
  useEffect(
    () => () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    },
    [],
  );

  const handleCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    requestClose();
  };

  const handleNativeClose = () => {
    // 外部要因で close されたとき（Esc の二重押しなど）も履歴を整合させる
    if (pushedRef.current) requestClose();
  };

  const handleBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) requestClose();
  };

  // showModal が使えない環境（`open` 属性フォールバック）では cancel イベントが来ないため、
  // Esc をここで受ける。preventDefault でブラウザ側の cancel とは二重にならない。
  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Escape' || !doc) return;
    e.preventDefault();
    requestClose();
  };

  return (
    <dialog
      ref={ref}
      className="document-dialog"
      aria-labelledby="dialog-title"
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
    >
      <article className="document-popup">
        <div className="popup-head">
          <span>機密解除 / EDITORIAL ARCHIVE</span>
          <button type="button" className="popup-close" aria-label="閉じる" onClick={requestClose}>
            ×
          </button>
        </div>
        <h2 id="dialog-title" ref={headingRef} tabIndex={-1}>
          {doc?.title}
        </h2>
        <div id="dialog-content" className="document-body">
          {doc?.content}
        </div>
        <div className="popup-foot">
          <div className="popup-pin">
            <button
              type="button"
              className="btn primary"
              aria-disabled={check && !check.ok ? true : undefined}
              aria-describedby={check && !check.ok ? 'dialog-pin-reason' : undefined}
              onClick={() => {
                if (!documentId || !check?.ok) return;
                onTogglePin(documentId);
              }}
            >
              {pinned ? 'ボードから外す' : '証拠ボードに貼る'}
            </button>
            {check && !check.ok && (
              <span id="dialog-pin-reason" className="disabled-copy">
                {PIN_REASON[check.reason]}
              </span>
            )}
          </div>
          <button type="button" className="btn ghost" onClick={requestClose}>
            戻る
          </button>
        </div>
      </article>
    </dialog>
  );
}
