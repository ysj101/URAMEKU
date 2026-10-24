import { ResetProgressPanel } from '../components/ResetProgressPanel';

export interface SettingsScreenProps {
  /** この端末の記録をすべて削除する（例: `game.resetAll`） */
  onResetAll: () => void;
  /** 選択中の事件だけをやり直す（例: `dispatch({ type: 'reset' })`）。未指定なら出さない */
  onResetCase?: () => void;
  /** 選択中の事件名 */
  caseTitle?: string;
}

/**
 * 設定画面（MVP-031）。画面遷移への組み込みは MVP-020 が行うため、
 * ここでは props だけで完結するコンポーネントにしている。
 */
export function SettingsScreen({ onResetAll, onResetCase, caseTitle }: SettingsScreenProps) {
  return (
    <>
      <div className="meter">
        <span>設定</span>
        <span>記録の管理</span>
      </div>
      <div className="notice">
        記録はこの端末（このブラウザ）の中だけに保存されます。サーバーには送信しません。
        別の端末やブラウザの記録には影響しません。
      </div>
      <ResetProgressPanel onResetAll={onResetAll} onResetCase={onResetCase} caseTitle={caseTitle} />
    </>
  );
}
