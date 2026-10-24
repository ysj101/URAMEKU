/**
 * アプリのルート。MVP-003 以降で画面・状態・ドメインロジックを分離して組み込む。
 * ここでは Vite + React + TypeScript の実行環境が成立していることだけを示す。
 */
export function App() {
  const base = import.meta.env.BASE_URL;
  return (
    <main className="app-shell" aria-labelledby="app-title">
      <header className="masthead">
        <p className="edition">ウラメク調査編集局 / ARCHIVE 001</p>
        <h1 id="app-title">
          ウラ<span>メク</span>
        </h1>
        <p className="tagline">見えているのは、ほんの一部。</p>
      </header>
      <section className="notice" aria-live="polite">
        <p>React + TypeScript + Vite の本実装環境を準備中です。</p>
        <p className="fine">
          配信ベースパス: <code>{base}</code>
          。静的試作は <code>prototype/</code> を参照してください。
        </p>
      </section>
    </main>
  );
}
