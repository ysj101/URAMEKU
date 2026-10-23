import { evaluateCase } from '../domain/scoring';
import type { GameApi } from '../state/useGame';

export function ResultScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const r = evaluateCase(current, progress);
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
        <ul>
          <li>
            必要な裏付け資料：{r.requiredFound.length} / {r.requiredTotal} 件
          </li>
          <li>関係する2資料の照合：{r.linkCorrect ? '成立' : '未成立'}</li>
          <li>
            数値検証メモ：{r.calculationsCorrect} / {r.calculationsTotal} 件
          </li>
          <li>見出しの論理的な断片：{r.fragmentsInPlace} / 3</li>
          <li>未使用の調査予算：{r.remainingBudget}</li>
        </ul>
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
            <div className="notice">
              すべての必要証拠を採用し、正しい2資料を結び、数値検証メモを完成させ、3つの断片を正しい順序に並べる必要があります。調査予算が不足した場合は最初からやり直せます。
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
