import { useEffect } from 'react';
import { initializeTelemetry, setTelemetryConsent, useTelemetryStatus } from '../telemetry/client';

export function TelemetryControls({ show }: { show: boolean }) {
  const status = useTelemetryStatus();
  useEffect(() => {
    void initializeTelemetry();
  }, []);
  if (!show) return null;
  if (status === 'disabled') return <p className="fine">操作の進み具合は送信していません。</p>;
  return (
    <aside className="notice" aria-label="操作の計測">
      <h2>操作の進み具合を送る</h2>
      <p>
        遊び方・CASE00と「平均おこづかい3000円」の操作の進み具合と時刻を送り、遊びやすさの改善に使います。選んだ答えや書いた文章は送りません。
      </p>
      <p>
        画面の種類とランダムなIDも送ります。IDはブラウザのタブごとに作ります。送らなくても遊べます。
      </p>
      <details>
        <summary>送信先と保存について</summary>
        <p>送信先：Grafana Cloud。受け取った記録の保存期間は30日です。</p>
        <p>
          いつでも送信を止められます。送信待ちの記録は消えますが、送信済みの記録は保存期間が過ぎるまで残ります。
        </p>
      </details>
      <p role="status">
        {status === 'on'
          ? '送信を許可しています。'
          : status === 'loading'
            ? '計測の準備中です。'
            : status === 'unavailable'
              ? '計測を利用できません。ゲームは続けられます。'
              : '送信は停止中です。'}
      </p>
      <div className="stage-switch">
        <button
          type="button"
          className="btn ghost"
          disabled={status === 'loading' || status === 'unavailable' || status === 'on'}
          onClick={() => setTelemetryConsent(true)}
        >
          送信を許可する
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={status === 'loading'}
          onClick={() => setTelemetryConsent(false)}
        >
          {status === 'on' ? '送信を止める' : '送信を断る'}
        </button>
      </div>
    </aside>
  );
}
