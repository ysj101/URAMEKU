import { useState } from 'react';
import {
  initMotionPreference,
  setMotionPreference,
  type MotionPreference,
} from '../app/motionSettings';
import { UI } from '../data/ui';
import { SettingSwitch } from './SettingSwitch';

/** 「演出を見せる」スイッチ（MVP-038 の設定を UI から切り替える）。オフ = 演出を減らす */
export function MotionToggle() {
  const [pref, setPref] = useState<MotionPreference>(() => initMotionPreference());
  const t = UI.settings.motion;
  const setShown = (shown: boolean) => {
    const next: MotionPreference = shown ? 'system' : 'reduced';
    setMotionPreference(next);
    setPref(next);
  };
  return (
    <div className="motion-toggle">
      <SettingSwitch label={t.label} checked={pref !== 'reduced'} onChange={setShown} />
      <p className="fine">{t.note}</p>
    </div>
  );
}
