import { useState } from 'react';
import {
  initMotionPreference,
  setMotionPreference,
  type MotionPreference,
} from '../app/motionSettings';

/** 演出を減らす設定のトグル（MVP-038 の設定を UI から切り替える） */
export function MotionToggle() {
  const [pref, setPref] = useState<MotionPreference>(() => initMotionPreference());
  const reduced = pref === 'reduced';
  const toggle = () => {
    const next: MotionPreference = reduced ? 'system' : 'reduced';
    setMotionPreference(next);
    setPref(next);
  };
  return (
    <div className="motion-toggle">
      <button type="button" className="btn ghost" aria-pressed={reduced} onClick={toggle}>
        演出を減らす{reduced ? '（オン）' : '（オフ）'}
      </button>
      <p className="fine">
        端末の「視差効果を減らす」設定がオンの場合は、この設定に関わらず演出を省略します。
      </p>
    </div>
  );
}
