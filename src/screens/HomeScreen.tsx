import { characterPose, propUrl } from '../data/assets';
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
        <div className="home-masthead">
          <p className="edition">ウラメク調査編集局</p>
          <span>調査と推理の体験紙 / 全5事件</span>
        </div>
        <h1 id="home-title" className="home-title">
          ウラメク
        </h1>
        <p className="home-tagline">{UI.home.subtitle}</p>
        <div className="home-frontpage">
          <div className="home-lead">
            <span className="home-scoop">本日の特集</span>
            <h2>
              その情報、
              <br />
              ウラがある。
            </h2>
            <p>
              広告、数字、みんなの声。
              <br />
              資料をめくり、証拠をつなぎ、
              <br />
              見出しの向こうの事実を探せ。
            </p>
          </div>
          <div
            className="home-ensemble"
            role="img"
            aria-label="調査編集局のシノブ、メガ、クロ、ハラダ部長"
          >
            <img className="home-clipping" src={propUrl('news')} alt="" />
            <img
              className="home-character home-character--mega"
              src={characterPose('mega')}
              alt=""
            />
            <img
              className="home-character home-character--harada"
              src={characterPose('harada')}
              alt=""
            />
            <img
              className="home-character home-character--shinobu"
              src={characterPose('shinobu', 'point')}
              alt=""
            />
            <img
              className="home-character home-character--kuro"
              src={characterPose('kuro')}
              alt=""
            />
            <span className="home-caption" aria-hidden="true">
              見えているものだけで、判断しない。
            </span>
          </div>
        </div>
      </div>
      <div className="home-actions">
        <h2 className="home-actions-title">編集局へようこそ</h2>
        <p className="home-actions-copy">一枚の資料から、調査をはじめよう。</p>
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
