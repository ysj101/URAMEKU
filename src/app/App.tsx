import { toHash, useNavigation } from './navigation';
import { useFocusOnRouteChange } from './useFocusOnRouteChange';
import './a11y.css';
import { CaseSelectScreen } from '../screens/CaseSelectScreen';
import { EncyclopediaScreen } from '../screens/EncyclopediaScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { TutorialScreen } from '../screens/TutorialScreen';
import { useGame } from '../state/useGame';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AudioControl } from '../components/AudioControl';
import { MotionToggle } from '../components/MotionToggle';
import { findCase } from '../data/cases';
import { SaveStatusBanner } from '../components/SaveStatusBanner';
import { OfflineBanner } from '../components/StatusView';
import { useEffect } from 'react';

export function App() {
  const game = useGame();
  const nav = useNavigation();
  const { route } = nav;
  // 画面遷移（ハッシュ）と、プレイ内の段階切替（調査→記事→結果）でフォーカスと告知を更新する
  const announcement = useFocusOnRouteChange(
    `${toHash(route)}|${game.stage}|${game.progress.published ? 'published' : 'editing'}`,
  );

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
      content = <EncyclopediaScreen game={game} nav={nav} />;
      break;
    case 'settings':
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
          <AudioControl className="settings-audio" />
          <MotionToggle />
          <SettingsScreen
            caseTitle={game.current.title}
            onResetCase={() => game.dispatch({ type: 'reset' })}
            onResetAll={() => {
              game.resetAll();
              nav.navigate({ screen: 'home' });
            }}
          />
        </section>
      );
      break;
    default:
      content = <HomeScreen game={game} nav={nav} />;
  }

  return (
    <>
      <a
        href="#workbench"
        className="skip-link"
        onClick={(e) => {
          // ハッシュルーティングと衝突しないよう、URL は変えずに main へフォーカスだけ移す
          e.preventDefault();
          document.getElementById('workbench')?.focus();
        }}
      >
        本編へ
      </a>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <main id="workbench" className="app-main" tabIndex={-1}>
        <OfflineBanner />
        <SaveStatusBanner status={game.saveStatus} />
        {content}
        <div className="footnote">
          このMVPは静的サイトとして動作します。調査内容はこのブラウザのみに保存され、サーバーへ送信しません。
        </div>
      </main>
    </>
  );
}
