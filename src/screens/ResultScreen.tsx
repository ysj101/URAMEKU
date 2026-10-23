import { FailureReasons } from '../components/FailureReasons';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { evaluateCase, failureReasons } from '../domain/scoring';
import type { GameApi } from '../state/useGame';

export function ResultScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const r = evaluateCase(current, progress);
  const reasons = r.cleared ? [] : failureReasons(current, progress);
  const docTitle = (id: string) => current.documents.find((d) => d.id === id)?.title ?? id;
  const fragText = (id: string) => current.headline_fragments.find((f) => f.id === id)?.text ?? id;

  const handleRevise = () => {
    if (r.cleared) game.goToNextCase();
    else {
      dispatch({ type: 'withdraw' });
      game.setStage('article');
    }
  };
  const handleRestart = () => {
    if (!window.confirm('この事件の調査途中の記録を最初からやり直しますか？')) return;
    dispatch({ type: 'reset' });
  };

  return (
    <>
      <div className="meter">
        <span>STEP 03 / 編集部の評価</span>
        <span>{r.cleared ? '掲載承認' : '追加調査が必要'}</span>
      </div>
      <div className="result">
        <div className="grade">{r.cleared ? 'A' : '—'}</div>
        <h3>{r.cleared ? '掲載可能な記事になりました！' : '記事を差し戻しました'}</h3>
        <p>
          評価点：<strong>{r.points} / 100</strong>（資料の妥当性・照合・見出し・調査効率）
        </p>
        <ScoreBreakdown rows={r.breakdown} />
        {r.cleared ? (
          <div className="explain">
            <h3>編集後記：{current.bias}</h3>
            <p>{current.debrief.explanation}</p>
            <p>
              <strong>持ち帰る視点：</strong>
              {current.debrief.takeaway}
            </p>
          </div>
        ) : (
          <>
            <FailureReasons reasons={reasons} />
            <div className="notice">
              不足している系統を補ってから再提出してください。調査予算が不足した場合は最初からやり直せます。
            </div>
            {progress.revealed ? (
              <div className="explain">
                <strong>答え合わせ</strong>
                <p>必要な資料：{current.required_evidence.map(docTitle).join('、')}</p>
                <p>照合：{current.required_link.map(docTitle).join(' ↔ ')}</p>
                <p>
                  検証メモ：
                  {current.analysis_tasks
                    .map((t) => `${t.prompt} = ${t.expected}${t.unit}`)
                    .join(' ／ ')}
                </p>
                <p>見出し：{current.correct_fragments.map(fragText).join(' ／ ')}</p>
                <p>{current.debrief.explanation}</p>
              </div>
            ) : (
              <button
                type="button"
                className="btn ghost"
                onClick={() => dispatch({ type: 'reveal' })}
              >
                解説と正解を公開する
              </button>
            )}
          </>
        )}
      </div>
      <div className="stage-switch">
        <button type="button" className="btn primary" onClick={handleRevise}>
          {r.cleared ? '別の事件に挑戦' : '記事を修正する'}
        </button>
        <button type="button" className="btn ghost" onClick={handleRestart}>
          この事件を最初から
        </button>
      </div>
    </>
  );
}
