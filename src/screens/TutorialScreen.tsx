import type { Navigation } from '../app/navigation';

/** プレースホルダー。本実装は MVP-021。 */
export function TutorialScreen({ nav }: { nav: Navigation }) {
  return (
    <section className="tutorial" aria-labelledby="tutorial-title">
      <div className="screen-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'home' })}
        >
          ← ホーム
        </button>
        <h1 id="tutorial-title">遊び方</h1>
      </div>
      <div className="notice">
        資料を調査し、重要な証拠をピン留め。2枚の資料を結び、数値を検算し、見出しの断片を3つ組み合わせて記事を提出します。
      </div>
      <div className="stage-switch">
        <button
          type="button"
          className="btn primary"
          onClick={() => nav.navigate({ screen: 'cases' })}
        >
          事件を選ぶ →
        </button>
      </div>
    </section>
  );
}
