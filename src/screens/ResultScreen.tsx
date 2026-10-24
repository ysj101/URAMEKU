import { useCallback, useRef, useState } from 'react';
import { useSound } from '../audio/useSound';
import { AnswerReveal } from '../components/AnswerReveal';
import { Debrief } from '../components/Debrief';
import { FailureReasons } from '../components/FailureReasons';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { Stamp } from '../components/Stamp';
import { evaluateCase, failureReasons } from '../domain/scoring';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';
import '../app/screens/result.css';

/**
 * 点数帯の評価ランク（文字）。uiGrade() の実在画像は A のみなので画像は使わない。
 * ランクはプレイヤーの評価ではなく、事件内の解決手順をどこまで踏めたかの記録
 * （docs/GAME_RULES.md 7 章）。
 */
function rankOf(points: number): 'S' | 'A' | 'B' | 'C' {
  if (points >= 100) return 'S';
  if (points >= 90) return 'A';
  if (points >= 75) return 'B';
  return 'C';
}

/**
 * 結果・解説・再挑戦画面（MVP-026）。
 *
 * - 掲載承認: 判子 → 評価点 → 編集後記（Debrief）→ 次の事件へ / この事件をもう一度
 * - 差し戻し: 判子 → 配点表 + 差し戻し理由 → 記事を修正 / 調査へ戻る / 解説と正解を公開する
 *   公開後は AnswerReveal（正解と自分の断片ごとの理由）と Debrief を出す。
 * - やり直しは window.confirm を使わず 2 段階ボタンで確認する。
 */
export function ResultScreen({ game, nav }: { game: GameApi; nav: Navigation }) {
  const { cases, current, progress, dispatch } = game;
  const r = evaluateCase(current, progress);
  const reasons = r.cleared ? [] : failureReasons(current, progress);

  const index = cases.findIndex((c) => c.id === current.id);
  const nextCase = index >= 0 ? cases[index + 1] : undefined;

  const play = useSound();
  const playedRef = useRef(false);
  const [settled, setSettled] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // 判子が押されたら効果音を 1 回だけ鳴らし、本文を表示する
  const handleSettled = useCallback(() => {
    setSettled(true);
    if (playedRef.current) return;
    playedRef.current = true;
    play(r.cleared ? 'case-complete' : 'incorrect');
  }, [play, r.cleared]);

  const goNext = () => {
    if (nextCase) {
      game.goToNextCase();
      nav.navigate({ screen: 'play', caseId: nextCase.id });
    } else {
      nav.navigate({ screen: 'cases' });
    }
  };
  const revise = () => {
    dispatch({ type: 'withdraw' });
    game.setStage('article');
  };
  const investigate = () => {
    dispatch({ type: 'withdraw' });
    game.setStage('investigate');
  };
  const reset = () => {
    setConfirmingReset(false);
    dispatch({ type: 'reset' });
  };

  return (
    <>
      <div className="meter">
        <span>STEP 03 / 編集部の評価</span>
        <span>{r.cleared ? '掲載承認' : '追加調査が必要'}</span>
      </div>
      <section
        className="result"
        aria-labelledby="result-title"
        data-settled={settled ? 'true' : 'false'}
        data-cleared={r.cleared ? 'true' : 'false'}
      >
        <div className="result-head">
          <h3 id="result-title">
            {r.cleared ? '掲載可能な記事になりました！' : '記事を差し戻しました'}
          </h3>
          <Stamp
            key={r.cleared ? 'accepted' : 'rejected'}
            kind={r.cleared ? 'accepted' : 'rejected'}
            className="result-stamp"
            onSettled={handleSettled}
          />
        </div>

        <div className="result-body">
          <div className="result-score">
            {r.cleared && (
              <div className="result-rank" aria-label={`評価ランク ${rankOf(r.points)}`}>
                <span className="result-rank-label" aria-hidden="true">
                  評価
                </span>
                {rankOf(r.points)}
              </div>
            )}
            <p>
              評価点：<strong>{r.points} / 100</strong>（資料の妥当性・照合・見出し・調査効率）
            </p>
          </div>
          <p className="result-scope">
            この点数はプレイヤーの評価ではなく、この事件の中で解決手順をどこまで踏めたかの記録です。
          </p>

          {r.cleared ? (
            <>
              <ScoreBreakdown rows={r.breakdown} />
              <Debrief caseData={current} />
              <div className="result-actions">
                <button type="button" className="btn primary" onClick={goNext}>
                  {nextCase ? '次の事件へ' : '事件一覧へ'}
                </button>
              </div>
            </>
          ) : (
            <>
              <ScoreBreakdown rows={r.breakdown} />
              <FailureReasons reasons={reasons} />
              <div className="notice">
                不足している系統を補ってから再提出してください。調査予算が不足した場合は最初からやり直せます。
              </div>
              <div className="result-actions">
                <button type="button" className="btn primary" onClick={revise}>
                  記事を修正する
                </button>
                <button type="button" className="btn ghost" onClick={investigate}>
                  調査へ戻る
                </button>
                {!progress.revealed && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => dispatch({ type: 'reveal' })}
                  >
                    解説と正解を公開する
                  </button>
                )}
              </div>
              {progress.revealed && (
                <>
                  <AnswerReveal caseData={current} progress={progress} />
                  <Debrief caseData={current} />
                </>
              )}
            </>
          )}

          <div className="result-reset">
            {confirmingReset ? (
              <div className="result-reset-confirm" role="group" aria-label="やり直しの確認">
                <p>
                  この事件の調査途中の記録（閲覧・採用・メモ・見出し）を消して最初から始めます。
                </p>
                <div className="result-actions">
                  <button type="button" className="btn primary" onClick={reset}>
                    やり直す
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmingReset(false)}
                  >
                    やめる
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn ghost" onClick={() => setConfirmingReset(true)}>
                この事件をもう一度
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
