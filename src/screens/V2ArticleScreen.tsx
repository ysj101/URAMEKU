import { useSound } from '../audio/useSound';
import { describeLink } from '../components/V2EvidenceBoard';
import { validV2Links } from '../domain/link';
import type { GameApi } from '../state/useGame';
import '../app/screens/article.css';
import '../app/screens/v2-integration.css';

/**
 * 調査報告。報告の骨子は読み取り・関係・判断の記録から自動で組み立てる。
 * 自由文（確認できたこと／未確認の点）は任意の補足で、提出や完了の条件にはしない。
 */
export function V2ArticleScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const play = useSound();
  const report = progress.v2?.report ?? { claim: '', uncertainty: '' };
  const canSubmit = !progress.published;
  const doc = (id: string) => current.documents.find((d) => d.id === id)?.title ?? id;
  const adopted = (id: string) => progress.opened.includes(id) && progress.pinned.includes(id);
  const tasks = current.v2?.decoding ?? [];
  const links = validV2Links(current, progress);
  const decision = progress.v2?.decisions.at(-1);
  const decisionDefinition = current.v2?.decision;
  return (
    <div className="v2-workspace">
      <div className="meter">
        <span data-focus-target tabIndex={-1}>
          STEP 02 / 調査報告をまとめる
        </span>
        <span>採用証拠 {progress.pinned.length} 件</span>
      </div>
      <section className="v2-panel" aria-labelledby="v2-report-title">
        <h2 id="v2-report-title">調査記録から報告をまとめる</h2>
        <p>{current.v2?.reportPrompt}</p>
        <p>
          報告の骨子は、デスクで残した記録から自動でまとまります。足りない記録があれば「調査へ戻る」で追記できます。
        </p>
        <section className="v2-report-digest" aria-label="報告に含まれる記録">
          <h3>読み取りの記録</h3>
          {tasks.length === 0 && <p>この事件に読み取りの問いはありません。</p>}
          {tasks.length > 0 && (
            <ol>
              {tasks.map((task) => {
                const record = progress.v2?.decoding[task.id];
                const chosen = task.options.find((option) => option.id === record?.optionId);
                return (
                  <li key={task.id}>
                    <p>{task.prompt}</p>
                    {chosen ? (
                      <p>
                        → {chosen.text}
                        <br />
                        <small>
                          参照資料：
                          {chosen.evidence
                            .map((id) => `${doc(id)}（${adopted(id) ? '採用済み' : '未採用'}）`)
                            .join('、')}
                        </small>
                      </p>
                    ) : (
                      <p>
                        <small>未回答</small>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <h3>資料の関係</h3>
          {links.length === 0 ? (
            <p>まだ関係を記録していません。</p>
          ) : (
            <ul>
              {links.map((link) => (
                <li key={`${link.from}:${link.to}:${link.relation}`}>
                  {describeLink(doc(link.from), doc(link.to), link.relation)}
                </li>
              ))}
            </ul>
          )}
          {decisionDefinition && (
            <>
              <h3>判断</h3>
              {decision ? (
                <p>
                  方針：
                  {decisionDefinition.options.find((o) => o.id === decision.optionId)?.text}
                  <br />
                  目的：
                  {decisionDefinition.objectives.find((o) => o.id === decision.objectiveId)?.text}
                  <br />
                  前提：{decision.assumptions}
                </p>
              ) : (
                <p>まだ判断を記録していません。</p>
              )}
            </>
          )}
        </section>
        <details className="v2-report-notes" open={Boolean(report.claim || report.uncertainty)}>
          <summary>自分の言葉で補足する（任意）</summary>
          <p>書かなくても提出できます。記録に残したいことがあれば自由に書いてください。</p>
          <label htmlFor="v2-report-claim">確認できたこと・採る方針</label>
          <textarea
            id="v2-report-claim"
            value={report.claim}
            maxLength={5000}
            onChange={(e) =>
              dispatch({
                type: 'v2-report',
                claim: e.target.value,
                uncertainty: report.uncertainty,
              })
            }
          />
          <label htmlFor="v2-report-uncertainty">未確認の点・判断の前提や留保</label>
          <textarea
            id="v2-report-uncertainty"
            value={report.uncertainty}
            maxLength={5000}
            onChange={(e) =>
              dispatch({ type: 'v2-report', claim: report.claim, uncertainty: e.target.value })
            }
          />
        </details>
      </section>
      <div className="stage-switch">
        <button
          type="button"
          className="btn primary"
          aria-disabled={!canSubmit || undefined}
          onClick={() => {
            if (!canSubmit) return;
            play('stamp');
            dispatch({ type: 'submit' });
          }}
        >
          報告を提出して振り返る
        </button>
        <button type="button" className="btn ghost" onClick={() => game.setStage('investigate')}>
          ← 調査へ戻る
        </button>
      </div>
    </div>
  );
}
