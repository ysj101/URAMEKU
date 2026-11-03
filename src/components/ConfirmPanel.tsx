import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface ConfirmPanelProps {
  /** 読み上げ用の名前（例: 「やり直しの確認」） */
  title: string;
  /** 何が起きるかを書いた確認文 */
  children: ReactNode;
  /** 実行ボタンの文言。押した操作と同じ動詞にする（「やり直す」「削除する」） */
  confirmLabel: string;
  /** 取りやめるボタンの文言。既定は「やめる」 */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

/**
 * 画面内の 2 段階確認。`window.confirm` の代わりに使う（docs/UI_GUIDE_LINT.md）。
 * 出た瞬間に確認文へフォーカスを移し、ボタンは「○○する」「やめる」の順に置く。
 */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  cancelLabel = 'やめる',
  onConfirm,
  onCancel,
  className = 'notice',
}: ConfirmPanelProps) {
  const descriptionId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={`confirm-panel ${className}`}
      role="alertdialog"
      aria-label={title}
      aria-describedby={descriptionId}
    >
      <p id={descriptionId}>{children}</p>
      <div className="stage-switch">
        <button type="button" className="btn primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
