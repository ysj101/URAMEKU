import { useEffect } from 'react';
import { initializeTelemetry, setTelemetryConsent, useTelemetryStatus } from '../telemetry/client';
import { SettingSwitch } from './SettingSwitch';

export function TelemetryControls({ settings = false }: { settings?: boolean }) {
  const status = useTelemetryStatus();
  useEffect(() => {
    void initializeTelemetry();
  }, []);
  if (status === 'disabled') return null;
  return (
    <section aria-label="操作の記録について">
      <p>
        遊びやすさの改善のため、遊び方・CASE00とCASE01「平均おこづかい3000円」の操作の進み具合・時刻・画面の種類・タブごとのランダムなIDをGrafana
        Cloudに送り、30日間保存します。選んだ答えや書いた文章は送りません。
      </p>
      <p>
        <a href="#/settings">設定</a>
        から送信を止められます。止めても遊べます。送信済みの記録は保存期間が過ぎるまで残ります。
      </p>
      {settings && (status === 'on' || status === 'off') && (
        <SettingSwitch
          label="操作の記録を送る"
          checked={status === 'on'}
          onChange={setTelemetryConsent}
        />
      )}
      <p role="status">
        {status === 'off'
          ? '送信は停止中です。'
          : status === 'loading'
            ? '計測の準備中です。'
            : status === 'unavailable'
              ? '計測を利用できません。ゲームは続けられます。'
              : '操作の記録を送信しています。'}
      </p>
    </section>
  );
}
