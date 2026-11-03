import { useState } from 'react';
import { UI } from '../data/ui';
import { ConfirmPanel } from './ConfirmPanel';

export interface ResetProgressPanelProps {
  /** この端末の記録をすべて削除する */
  onResetAll: () => void;
  /** 選択中の事件だけをやり直す。未指定ならその操作を出さない */
  onResetCase?: () => void;
  /** 選択中の事件名（確認文に表示） */
  caseTitle?: string;
}

type Operation = 'case' | 'all';

/**
 * 進捗リセット / 全件削除のパネル（MVP-031）。
 * 誤操作防止のため、ボタン → 確認文 + 「やり直す」「削除する」/「やめる」の 2 段階で実行する（ConfirmPanel）。
 */
export function ResetProgressPanel({
  onResetAll,
  onResetCase,
  caseTitle,
}: ResetProgressPanelProps) {
  const [pending, setPending] = useState<Operation | null>(null);
  const [done, setDone] = useState<Operation | null>(null);

  const start = (op: Operation) => {
    setDone(null);
    setPending(op);
  };
  const cancel = () => setPending(null);
  const execute = () => {
    if (pending === 'case') onResetCase?.();
    if (pending === 'all') onResetAll();
    setDone(pending);
    setPending(null);
  };

  const caseLabel = caseTitle ? `「${caseTitle}」` : 'この事件';

  return (
    <section className="reset-progress-panel" aria-labelledby="reset-progress-heading">
      <h2 id="reset-progress-heading">記録の削除</h2>
      <p className="disabled-copy">
        削除した記録は元に戻せません。削除の対象はこの端末（このブラウザ）に保存された記録だけです。
      </p>

      {pending === null && (
        <div className="stage-switch">
          {onResetCase && (
            <button type="button" className="btn ghost" onClick={() => start('case')}>
              {UI.case.retry}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => start('all')}>
            この端末の記録をすべて削除
          </button>
        </div>
      )}

      {pending === 'case' && (
        <ConfirmPanel
          title={UI.case.retryConfirmTitle}
          confirmLabel={UI.case.retryConfirm}
          onConfirm={execute}
          onCancel={cancel}
        >
          {caseLabel}
          {UI.case.retryConfirmBody}
        </ConfirmPanel>
      )}
      {pending === 'all' && (
        <ConfirmPanel
          title="削除の確認"
          confirmLabel="削除する"
          onConfirm={execute}
          onCancel={cancel}
        >
          この端末に保存された、すべての事件の進行とクリア記録を削除します。よろしいですか？
        </ConfirmPanel>
      )}

      {done !== null && (
        <p className="notice" role="status">
          {done === 'case'
            ? `${caseLabel}の記録を消しました。最初から調査できます。`
            : 'この端末の記録をすべて削除しました。'}
        </p>
      )}
    </section>
  );
}
