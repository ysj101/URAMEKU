import { useSound } from '../audio/useSound';
import type { GameApi } from '../state/useGame';
import '../app/screens/article.css';
import '../app/screens/v2-integration.css';

export function V2ArticleScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const play = useSound();
  const report = progress.v2?.report ?? { claim: '', uncertainty: '' };
  const canSubmit = Boolean(report.claim.trim() && report.uncertainty.trim());
  return (
    <div className="v2-workspace">
      <div className="meter">
        <span data-focus-target tabIndex={-1}>
          STEP 02 / 調査報告をまとめる
        </span>
        <span>採用証拠 {progress.pinned.length} 件</span>
      </div>
      <section className="v2-panel" aria-labelledby="v2-report-title">
        <h2 id="v2-report-title">根拠と留保を添えた報告</h2>
        <p>{current.v2?.reportPrompt}</p>
        <p>
          ボードの関係と読み取りの記録を確かめて、確認できたこととまだ分からないことを分けて残します。
        </p>
        <label htmlFor="v2-report-claim">確認できたこと・採る方針</label>
        <textarea
          id="v2-report-claim"
          value={report.claim}
          maxLength={5000}
          onChange={(e) =>
            dispatch({ type: 'v2-report', claim: e.target.value, uncertainty: report.uncertainty })
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
      </section>
      <div className="stage-switch">
        <button
          type="button"
          className="btn primary"
          aria-disabled={!canSubmit || undefined}
          aria-describedby={!canSubmit ? 'v2-submit-reason' : undefined}
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
      {!canSubmit && (
        <p id="v2-submit-reason" role="status">
          確認できたことと、未確認の点や前提を記録してください。
        </p>
      )}
    </div>
  );
}
