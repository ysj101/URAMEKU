import type { Navigation } from '../app/navigation';

/** プレースホルダー。本実装は MVP-027。 */
export function EncyclopediaScreen({ nav }: { nav: Navigation }) {
  return (
    <section className="encyclopedia" aria-labelledby="encyclopedia-title">
      <div className="screen-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'home' })}
        >
          ← ホーム
        </button>
        <h1 id="encyclopedia-title">図鑑</h1>
      </div>
      <div className="notice">事件を解決すると、関連する考え方がここに追加されます。</div>
    </section>
  );
}
