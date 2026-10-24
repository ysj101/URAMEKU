import { assetUrl } from '../data/assets';
import { UI } from '../data/ui';
import { continueCaseId } from '../domain/caseStatus';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';

export function HomeScreen({ game, nav }: { game: GameApi; nav: Navigation }) {
  const solvedCount = game.cases.filter((c) => game.finished[c.id]).length;
  const continueId = continueCaseId(
    game.cases,
    game.current.id,
    game.progressByCase ?? {},
    game.finished,
  );
  const hasProgress = Object.keys(game.progressByCase ?? {}).length > 0 || solvedCount > 0;

  return (
    <section className="home" aria-labelledby="home-title">
      <div className="home-hero">
        <p className="edition">ウラメク調査編集局 / ARCHIVE 001</p>
        <h1 id="home-title" className="home-title">
          ウラ<span>メク</span>
        </h1>
        <p className="home-tagline">{UI.home.subtitle}</p>
        <img
          className="home-mascot"
          src={assetUrl('characters/shinobu/poses/point.png')}
          alt="調査記者シノブ"
        />
      </div>
      <div className="home-actions">
        {hasProgress && continueId ? (
          <button
            type="button"
            className="btn primary big"
            onClick={() => {
              game.selectCase(continueId);
              nav.navigate({ screen: 'play', caseId: continueId });
            }}
          >
            {UI.home.continue}
          </button>
        ) : (
          <button
            type="button"
            className="btn primary big"
            onClick={() => nav.navigate({ screen: 'tutorial' })}
          >
            {UI.home.start}
          </button>
        )}
        <button
          type="button"
          className="btn ghost big"
          onClick={() => nav.navigate({ screen: 'cases' })}
        >
          {UI.home.cases}
          <small>
            解決 {solvedCount} / {game.cases.length}
          </small>
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'encyclopedia' })}
        >
          {UI.home.encyclopedia}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'settings' })}
        >
          {UI.home.settings}
        </button>
      </div>
      <p className="fine home-notice">{UI.notices.fiction}</p>
      <p className="fine home-notice">{UI.notices.notDiagnosis}</p>
    </section>
  );
}
