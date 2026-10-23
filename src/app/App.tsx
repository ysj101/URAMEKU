import { useNavigation } from './navigation';
import { CaseSelectScreen } from '../screens/CaseSelectScreen';
import { EncyclopediaScreen } from '../screens/EncyclopediaScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { TutorialScreen } from '../screens/TutorialScreen';
import { useGame } from '../state/useGame';
import { findCase } from '../data/cases';
import { useEffect } from 'react';

export function App() {
  const game = useGame();
  const nav = useNavigation();
  const { route } = nav;

  // URL で事件を直接指定された場合は保存中の事件を切り替える
  useEffect(() => {
    if (
      route.screen === 'play' &&
      route.caseId &&
      findCase(route.caseId) &&
      route.caseId !== game.current.id
    ) {
      game.selectCase(route.caseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.screen, route.caseId]);

  const handleResetAll = () => {
    if (!window.confirm('この端末に保存された全ケースの進捗を削除しますか？')) return;
    game.resetAll();
    nav.navigate({ screen: 'home' });
  };

  let content;
  switch (route.screen) {
    case 'cases':
      content = <CaseSelectScreen game={game} nav={nav} />;
      break;
    case 'play':
      content = <PlayScreen game={game} nav={nav} />;
      break;
    case 'tutorial':
      content = <TutorialScreen nav={nav} />;
      break;
    case 'encyclopedia':
      content = <EncyclopediaScreen nav={nav} />;
      break;
    case 'settings':
      // 本実装は MVP-031（進捗削除）と MVP-037（音量）で差し替える
      content = (
        <section className="settings" aria-labelledby="settings-title">
          <div className="screen-head">
            <button
              type="button"
              className="btn ghost"
              onClick={() => nav.navigate({ screen: 'home' })}
            >
              ← ホーム
            </button>
            <h1 id="settings-title">設定</h1>
          </div>
          <button type="button" className="link-button" onClick={handleResetAll}>
            この端末の記録を削除
          </button>
        </section>
      );
      break;
    default:
      content = <HomeScreen game={game} nav={nav} />;
  }

  return (
    <>
      <a href="#workbench" className="skip-link">
        本編へ
      </a>
      <main id="workbench" className="app-main" tabIndex={-1}>
        {content}
        <div className="footnote">
          このMVPは静的サイトとして動作します。調査内容はこのブラウザのみに保存され、サーバーへ送信しません。
        </div>
      </main>
    </>
  );
}
