import { CaseHeader } from '../components/CaseHeader';
import { CaseList } from '../components/CaseList';
import { assetUrl } from '../data/assets';
import { ArticleScreen } from '../screens/ArticleScreen';
import { InvestigationScreen } from '../screens/InvestigationScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { useGame } from '../state/useGame';

export function App() {
  const game = useGame();
  const { current, progress, stage } = game;

  const handleResetAll = () => {
    if (!window.confirm('この端末に保存された全ケースの進捗を削除しますか？')) return;
    game.resetAll();
  };

  return (
    <>
      <a href="#workbench" className="skip-link">
        ゲーム本編へ
      </a>
      <header className="masthead">
        <div className="brand">
          <span className="edition">ウラメク調査編集局 / ARCHIVE 001</span>
          <h1>
            ウラ<span>メク</span>
          </h1>
          <p>見えているのは、ほんの一部。</p>
        </div>
        <img
          src={assetUrl('characters/shinobu/poses/idle.png')}
          alt="新聞社の調査記者シノブ"
          className="logo-char"
        />
      </header>
      <div className="page">
        <aside className="sidebar" aria-label="事件選択">
          <div className="small-heading">事件ファイル</div>
          <CaseList
            cases={game.cases}
            activeId={current.id}
            finished={game.finished}
            onSelect={game.selectCase}
          />
          <div className="info-panel">
            <strong>遊び方</strong>
            <p>
              資料を調査し、重要な証拠をピン留め。2枚の資料を結び、見出しの断片を3つ組み合わせて記事を提出します。
            </p>
            <p className="fine">企業・統計・人物は架空。判断傾向の心理診断は行いません。</p>
          </div>
          <button type="button" className="link-button" onClick={handleResetAll}>
            この端末の記録を削除
          </button>
        </aside>
        <main id="workbench" className="workbench" tabIndex={-1}>
          <CaseHeader caseData={current} />
          <div id="game">
            {progress.published ? (
              <ResultScreen game={game} />
            ) : stage === 'article' ? (
              <ArticleScreen game={game} />
            ) : (
              <InvestigationScreen game={game} />
            )}
          </div>
          <div className="footnote">
            このMVPは静的サイトとして動作します。調査内容はこのブラウザのみに保存され、サーバーへ送信しません。
          </div>
        </main>
      </div>
    </>
  );
}
