import { assetUrl } from '../data/assets';
import { UI } from '../data/ui';
import {
  CASE_STATUS_LABEL,
  DIFFICULTY_LABEL,
  caseStatus,
  difficultyLevel,
} from '../domain/caseStatus';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';

export function CaseSelectScreen({ game, nav }: { game: GameApi; nav: Navigation }) {
  return (
    <section className="case-select" aria-labelledby="cases-title">
      <div className="screen-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'home' })}
        >
          ← ホーム
        </button>
        <h1 id="cases-title">{UI.home.cases}</h1>
      </div>
      <ul className="case-cards">
        {game.cases.map((c, i) => {
          const status = caseStatus(c.id, (game.progressByCase ?? {})[c.id], game.finished);
          const level = difficultyLevel(c.difficulty);
          return (
            <li key={c.id} className={`case-card status-${status}`}>
              <button
                type="button"
                className="case-card-button"
                aria-label={`CASE ${String(i + 1).padStart(2, '0')} ${c.title}、難易度 ${DIFFICULTY_LABEL[c.difficulty]}、${CASE_STATUS_LABEL[status]}`}
                onClick={() => {
                  game.selectCase(c.id);
                  nav.navigate({ screen: 'play', caseId: c.id });
                }}
              >
                <img
                  className="case-card-state"
                  src={assetUrl(
                    `ui/states/${status === 'investigating' ? 'investigate' : status}.png`,
                  )}
                  alt=""
                />
                <span className="case-card-num">CASE {String(i + 1).padStart(2, '0')}</span>
                <span className="case-card-title">{c.title}</span>
                <span className="case-card-meta">
                  <span className="difficulty" aria-hidden="true">
                    {'●'.repeat(level)}
                    {'○'.repeat(3 - level)}
                  </span>{' '}
                  {DIFFICULTY_LABEL[c.difficulty]} / {c.estimated_time}
                </span>
                <span className={`case-card-status status-${status}`}>
                  {CASE_STATUS_LABEL[status]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="fine">{UI.notices.fiction}</p>
    </section>
  );
}
