import { DocumentLabel } from './DocumentLabel';
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from 'react';
import type { CaseData, CaseProgress } from '../domain/types';

interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  /** 開いている資料 ID。null なら閉じる */
  documentId: string | null;
  onClose: () => void;
}

/** history.pushState に積む状態。popstate で見分けるための印 */
export interface DocumentHistoryState {
  doc: string;
}

/**
 * 資料の全文を表示するモーダル（MVP-022）。
 * 開いた資料はそのまま根拠候補になるので、ここに「貼る」操作はない。
 *
 * 閉じ方は 3 通り: 背景タップ、Esc（`cancel`）、ブラウザの戻る（`popstate`）。
 * 開くときに `history.pushState({ doc }, '')` を積み、閉じるボタン等では `history.back()` で
 * 状態を整合させる。ハッシュは変えないので `navigation.ts` のハッシュルートとは干渉しない。
 */
export function DocumentDialog({ caseData, progress, documentId, onClose }: Props) {
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
  const read = documentId ? progress.opened.includes(documentId) : false;

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
      data-visual={doc?.visual}
      aria-labelledby="dialog-title"
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
    >
      <article className="document-popup motion-page-turn">
        <div className="popup-head">
          <span>機密解除 / EDITORIAL ARCHIVE</span>
          <button type="button" className="popup-close" aria-label="閉じる" onClick={requestClose}>
            ×
          </button>
        </div>
        {doc && (
          <DocumentLabel
            caseId={caseData.id}
            index={caseData.documents.indexOf(doc)}
            documentId={doc.id}
            visual={doc.visual}
            cost={doc.cost}
          />
        )}
        <h2 id="dialog-title" ref={headingRef} tabIndex={-1}>
          {doc?.title}
        </h2>
        <div id="dialog-content" className="document-body">
          {doc?.content}
        </div>
        <div className="popup-foot">
          <p className="popup-read" role="status">
            {read ? 'この資料は読んだので、記録の根拠として使えます。' : ''}
          </p>
          <button type="button" className="btn primary" onClick={requestClose}>
            戻る
          </button>
        </div>
      </article>
    </dialog>
  );
}
