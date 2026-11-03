import { UI } from '../data/ui';
import { useTutorialState } from '../state/tutorialState';
import type { StorageLike } from '../state/persistence';
import { SettingSwitch } from './SettingSwitch';

/** 「はじめてのヒントを表示する」スイッチ。「ヒントを閉じる」で消したヒントをここで戻せる */
export function HintToggle({ storage }: { storage?: StorageLike | null }) {
  const { state, enableHints, disableHints } = useTutorialState(storage);
  return (
    <div className="hint-toggle">
      <SettingSwitch
        label={UI.settings.hints.label}
        checked={state.hintsEnabled}
        onChange={(next) => (next ? enableHints() : disableHints())}
      />
      <p className="fine">{UI.settings.hints.note}</p>
    </div>
  );
}
