import { UI } from '../data/ui';

export interface SettingSwitchProps {
  /** 項目名。「〜する」の肯定形にし、オン = その通りになる、にそろえる */
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}

/**
 * 設定画面のスイッチ（切り替えた瞬間に効く二択）。
 * 名前は項目名、状態は aria-checked で伝える。見た目の「オン / オフ」は補助なので読み上げない。
 */
export function SettingSwitch({ label, checked, onChange, className }: SettingSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={['setting-switch', className].filter(Boolean).join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className="setting-switch__label">{label}</span>
      <span className="setting-switch__state" aria-hidden="true">
        {checked ? UI.settings.on : UI.settings.off}
      </span>
    </button>
  );
}
