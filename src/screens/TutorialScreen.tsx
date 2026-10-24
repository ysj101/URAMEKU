import { useId, useState, type KeyboardEvent } from 'react';
import { TUTORIAL_STEPS, tutorialStep, type TutorialStep } from '../data/assets';
import { UI } from '../data/ui';
import { useTutorialState } from '../state/tutorialState';
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
 * 遊び方（MVP-021）。6 枚の手順画像をカルーセルで見せる。
 * 説明は画像内の文字に頼らず HTML テキストで表示する（MVP_SPEC 12 章）。
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

  const stepLabel = UI.tutorial.stepLabel
    .replace('{n}', String(index + 1))
    .replace('{total}', String(total));

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
          <figure className="tutorial-figure">
            {/* 画像は補助。説明は右のテキストで完結させるため alt は空にする */}
            <img src={tutorialStep(step)} alt="" width={600} height={440} />
          </figure>
          <div>
            <span className="tutorial-step-number">{stepLabel}</span>
            <h2 id={headingId}>{content.title}</h2>
            <p>{content.body}</p>
          </div>
        </div>

        <ol className="tutorial-dots" aria-label={UI.tutorial.carouselLabel}>
          {TUTORIAL_STEPS.map((n, i) => (
            <li key={n}>
              <button
                type="button"
                className="tutorial-dot"
                aria-current={i === index ? 'step' : undefined}
                aria-label={UI.tutorial.stepLabel
                  .replace('{n}', String(i + 1))
                  .replace('{total}', String(total))}
                onClick={() => goTo(i)}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>

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
      <p className="fine">{UI.notices.fiction}</p>
    </section>
  );
}
