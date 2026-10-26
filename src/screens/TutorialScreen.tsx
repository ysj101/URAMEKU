import { useId, useState, type KeyboardEvent } from 'react';
import { TUTORIAL_STEPS, type TutorialStep } from '../data/assets';
import { UI } from '../data/ui';
import { useTutorialState } from '../state/tutorialState';
import { TutorialScene } from '../components/TutorialScene';
import { sceneForStep } from '../components/tutorialScenes';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';
import type { StorageLike } from '../state/persistence';
import '../app/screens/tutorial.css';

export const FIRST_CASE_ID = 'case-01';

export interface TutorialScreenProps {
  nav: Navigation;
  /** 省略可。渡されていれば最後のボタンで CASE 01 を選択する（App は URL 経由でも選択する） */
  game?: Pick<GameApi, 'selectCase'>;
  /** テスト用の保存先差し替え */
  storage?: StorageLike | null;
}

/**
 * 遊び方（MVP-021）。6 つの手順をカルーセルで見せる。
 * 左に調査画面の簡略モックを置き、その手順で触る場所を赤い枠で示す。
 * 説明はモック内の文字に頼らず右側の HTML テキストで完結させる（MVP_SPEC 12 章）。
 */
export function TutorialScreen({ nav, game, storage }: TutorialScreenProps) {
  const [index, setIndex] = useState(0);
  const { markCompleted } = useTutorialState(storage);
  const headingId = useId();
  const total = TUTORIAL_STEPS.length;
  const step = TUTORIAL_STEPS[index] as TutorialStep;
  const content = UI.tutorial.steps[index]!;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const goTo = (next: number) => setIndex(Math.min(total - 1, Math.max(0, next)));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(total - 1);
    }
  };

  const finish = (screen: 'cases' | 'play') => {
    markCompleted();
    if (screen === 'play') {
      game?.selectCase(FIRST_CASE_ID);
      nav.navigate({ screen: 'play', caseId: FIRST_CASE_ID });
    } else {
      nav.navigate({ screen: 'cases' });
    }
  };

  const labelOf = (n: number) =>
    UI.tutorial.stepLabel.replace('{n}', String(n)).replace('{total}', String(total));
  const stepLabel = labelOf(index + 1);

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
        <h1 id="tutorial-title">{UI.tutorial.title}</h1>
      </div>
      <p className="tutorial-lead">{UI.tutorial.lead}</p>

      <div
        className="tutorial-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label={UI.tutorial.carouselLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div
          className="tutorial-slide"
          role="group"
          aria-roledescription="slide"
          aria-label={stepLabel}
          aria-live="polite"
        >
          <div className="tutorial-scene-column">
            <span className="tutorial-scene-label" aria-hidden="true">
              {UI.tutorial.sceneLabel}
            </span>
            <TutorialScene scene={sceneForStep(step)} callout={content.guide.callout} />
            <p className="tutorial-scene-note">{UI.tutorial.sceneNote}</p>
          </div>

          <div className="tutorial-text">
            <ol className="tutorial-dots" aria-label={UI.tutorial.carouselLabel}>
              {TUTORIAL_STEPS.map((n, i) => (
                <li key={n}>
                  <button
                    type="button"
                    className="tutorial-dot"
                    aria-current={i === index ? 'step' : undefined}
                    aria-label={labelOf(i + 1)}
                    onClick={() => goTo(i)}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ol>
            <span className="tutorial-step-number">{stepLabel}</span>
            <h2 id={headingId}>{content.title}</h2>
            <p className="tutorial-body">{content.body}</p>
            <dl className="tutorial-guide" aria-label={UI.tutorial.guideHeading}>
              <dt>{UI.tutorial.guideLabels.spot}</dt>
              <dd>{content.guide.spot}</dd>
              <dt>{UI.tutorial.guideLabels.cue}</dt>
              <dd>{content.guide.cue}</dd>
              <dt>{UI.tutorial.guideLabels.result}</dt>
              <dd>{content.guide.result}</dd>
            </dl>

            <div className="tutorial-controls">
              <button
                type="button"
                className="btn ghost"
                disabled={isFirst}
                onClick={() => goTo(index - 1)}
              >
                {UI.tutorial.prev}
              </button>
              {isLast ? (
                <button type="button" className="btn primary" onClick={() => finish('play')}>
                  {UI.tutorial.start}
                </button>
              ) : (
                <button type="button" className="btn secondary" onClick={() => goTo(index + 1)}>
                  {UI.tutorial.next}
                </button>
              )}
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => finish('cases')}>
                {UI.tutorial.skip}
              </button>
            </div>
            <p className="tutorial-keyboard-note">{UI.tutorial.keyboardNote}</p>
          </div>
        </div>
      </div>
      <p className="fine">{UI.notices.fiction}</p>
    </section>
  );
}
