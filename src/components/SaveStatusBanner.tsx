import { UI } from '../data/ui';
import { uiIcon } from '../data/assets';
import type { SaveStatus } from '../state/useGame';
import '../app/screens/status.css';

export interface SaveStatusBannerProps {
  /** `game.saveStatus`。`saved` / 未指定なら何も出さない */
  status?: SaveStatus;
  /** 設定画面へ移動する。未指定ならリンク（`#/settings`）を使う */
  onOpenSettings?: () => void;
}

/**
 * 保存できない状態を画面上部で知らせ、回復方法を示す（MVP-028）。
 * - failed: 容量不足の可能性。他サイトのデータ整理か、設定から記録を削除
 * - unavailable: プライベートモードなどで保存先が無い。閉じると進行が消える
 * 記録の削除はここでは行わず、設定画面へ誘導するだけにする。
 */
export function SaveStatusBanner({ status, onOpenSettings }: SaveStatusBannerProps) {
  if (status !== 'failed' && status !== 'unavailable') return null;

  const failed = status === 'failed';
  const text = failed ? UI.status.saveFailed : UI.status.saveUnavailable;

  return (
    <div
      className={`status-banner${failed ? ' is-warning' : ''}`}
      role="alert"
      data-kind={`save-${status}`}
    >
      <img
        className="status-banner__icon"
        src={uiIcon(failed ? 'warning' : 'lock')}
        alt=""
        width={24}
        height={24}
      />
      <p className="status-banner__text">
        <span className="status-banner__title">{text.title}</span>
        {text.body}
      </p>
      {failed && (
        <div className="status-banner__actions">
          {onOpenSettings ? (
            <button type="button" className="btn ghost" onClick={onOpenSettings}>
              {UI.status.saveFailed.settings}
            </button>
          ) : (
            <a className="btn ghost" href="#/settings">
              {UI.status.saveFailed.settings}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
