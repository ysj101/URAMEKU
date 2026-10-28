import { CaseHeader } from '../components/CaseHeader';
import { TutorialHint } from '../components/TutorialHint';
import { ArticleScreen } from './ArticleScreen';
import { InvestigationScreen } from './InvestigationScreen';
import { ResultScreen } from './ResultScreen';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';

/** 1 事件のプレイ画面。調査 → 記事 → 結果を内包する。 */
export function PlayScreen({ game, nav }: { game: GameApi; nav: Navigation }) {
  const { current, progress, stage } = game;
  return (
    <section className="play" aria-labelledby="case-title">
      <div className="screen-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'cases' })}
        >
          ← 事件一覧
        </button>
      </div>
      <CaseHeader caseData={current} />
      <TutorialHint caseData={current} progress={progress} stage={stage} />
      <div id="game">
        {progress.published ? (
          <ResultScreen game={game} nav={nav} />
        ) : stage === 'article' ? (
          <ArticleScreen game={game} />
        ) : (
          <InvestigationScreen game={game} />
        )}
      </div>
    </section>
  );
}
