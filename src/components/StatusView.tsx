import { useState, type ReactNode } from 'react';
import { UI } from '../data/ui';
import { uiIcon, uiIllustration, type UiIllustrationName } from '../data/assets';
import { useOnline, useOnlineEpoch } from '../app/useOnline';
import '../app/screens/status.css';

/**
 * 画面状態の種類（MVP-028）。
 * - loading: 遅延読込・画像読込の待機（現状のデータは同期 import なので将来用）
 * - empty: 図鑑未解放・証拠ボード空など、他画面が使える共通「空」表示
 * - offline: 接続なし。ゲームは端末内で動作する
 * - error: 描画エラー（ErrorBoundary から使う）
 * - save-failed / save-unavailable: 端末への保存ができない
 */
export type StatusKind =
  'loading' | 'empty' | 'offline' | 'error' | 'save-failed' | 'save-unavailable';

const ILLUSTRATION: Record<StatusKind, UiIllustrationName | null> = {
  loading: null,
  empty: 'empty',
  offline: 'offline',
  error: 'error',
  'save-failed': 'error',
  'save-unavailable': 'locked',
};

const DEFAULT_TEXT: Record<StatusKind, { title: string; body: string }> = {
  loading: UI.status.loading,
  empty: UI.status.empty,
  offline: UI.status.offline,
  error: UI.status.error,
  'save-failed': UI.status.saveFailed,
  'save-unavailable': UI.status.saveUnavailable,
};

export interface StatusViewProps {
  kind: StatusKind;
  /** 見出し。省略時は `data/ui/ja.json` の `status.*.title` */
  title?: string;
  /** 専用説明。省略時は `status.*.body` */
  body?: ReactNode;
  /** 回復手段（ボタン等） */
  actions?: ReactNode;
  /** 技術情報。`details` に折りたたんで表示 */
  details?: string;
  /** 挿絵の差し替え。null で非表示 */
  illustration?: UiIllustrationName | null;
  className?: string;
}

/**
 * ロード / 空 / オフライン / エラー / 保存失敗の共通表示。
 * 各状態に「何が起きているか」と「どうすれば戻れるか」を必ず添える。
 * 利用者の性質を評価する文言は含めない。
 */
export function StatusView({
  kind,
  title,
  body,
  actions,
  details,
  illustration,
  className,
}: StatusViewProps) {
  const text = DEFAULT_TEXT[kind];
  const art = illustration === undefined ? ILLUSTRATION[kind] : illustration;
  const isError = kind === 'error' || kind === 'save-failed';
  const classes = ['status-view', `is-${kind}`, isError ? 'is-error' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={classes}
      role={isError ? 'alert' : 'status'}
      aria-busy={kind === 'loading' ? true : undefined}
      aria-live={isError ? undefined : 'polite'}
      data-kind={kind}
    >
      {art && (
        <img
          className="status-view__art"
          src={uiIllustration(art)}
          alt=""
          width={160}
          height={160}
          decoding="async"
        />
      )}
      <h2 className="status-view__title">{title ?? text.title}</h2>
      <p className="status-view__body">{body ?? text.body}</p>
      {actions && <div className="status-view__actions">{actions}</div>}
      {details && (
        <details className="status-view__details">
          <summary>{UI.status.error.details}</summary>
          <pre>{details}</pre>
        </details>
      )}
    </section>
  );
}

/**
 * オフライン時に画面上部へ出す `role="status"` のバナー。
 * 「閉じる」で消せるが、いったん接続が戻り再度オフラインになったら再表示する。
 */
export function OfflineBanner() {
  const online = useOnline();
  const epoch = useOnlineEpoch();
  const [dismissedEpoch, setDismissedEpoch] = useState<number | null>(null);

  if (online || dismissedEpoch === epoch) return null;

  const text = UI.status.offline;
  return (
    <div className="status-banner" role="status" data-kind="offline">
      <img className="status-banner__icon" src={uiIcon('offline')} alt="" width={24} height={24} />
      <p className="status-banner__text">
        <span className="status-banner__title">{UI.states.offline}</span>
        {text.body}
      </p>
      <div className="status-banner__actions">
        <button type="button" className="btn ghost" onClick={() => setDismissedEpoch(epoch)}>
          {text.dismiss}
        </button>
      </div>
    </div>
  );
}
