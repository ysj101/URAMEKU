import { useSound } from '../audio/useSound';
import { ArticleEditor } from '../components/ArticleEditor';
import { canSubmitArticle } from '../domain/publish';
import { ARTICLE_LENGTH } from '../domain/types';
import type { GameApi } from '../state/useGame';
import '../app/screens/article.css';

/** 提出できない理由（提出できるなら null） */
function submitBlockedReason(progress: GameApi['progress']): string | null {
  if (progress.published) return 'この記事は提出済みです。';
  const missing = ARTICLE_LENGTH - progress.article.length;
  if (missing > 0) return `断片があと ${missing} 個必要です。`;
  return null;
}

export function ArticleScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const play = useSound();
  const filledCalcs = Object.values(progress.calculations).filter((v) => v !== '').length;
  const reason = submitBlockedReason(progress);
  const canSubmit = reason === null && canSubmitArticle(progress);

  const handleSubmit = () => {
    if (!canSubmit) return;
    play('stamp');
    dispatch({ type: 'submit' });
  };

  return (
    <>
      <div className="meter">
        <span data-focus-target tabIndex={-1}>
          STEP 02 / 記事を組み立てる
        </span>
        <span>
          採用証拠 {progress.pinned.length} 件 / 検証メモ {filledCalcs} 件
        </span>
      </div>
      <div className="article-top">
        事件を裏付ける資料を証拠ボードに貼り、2枚の照合関係を示したうえで記事を提出します。下の断片8個から、
        <strong>正確な見出しを構成する3つ</strong>
        を順番に選びます。スロットをタップすると差し替え、↑↓で順序の入れ替え、「外す」で撤回できます。差し戻された記事は直前の見出しが残るので、何度でも組み直せます。
      </div>
      <ArticleEditor
        caseData={current}
        progress={progress}
        onAdd={(fragmentId) => dispatch({ type: 'add-fragment', fragmentId })}
        onRemove={(index) => dispatch({ type: 'remove-fragment', index })}
        onReplace={(index, fragmentId) => dispatch({ type: 'replace-fragment', index, fragmentId })}
        onMove={(from, to) => dispatch({ type: 'move-fragment', from, to })}
        onClear={() => dispatch({ type: 'clear-article' })}
      />
      <div className="notice">
        資料を調査しただけでは根拠になりません。証拠ボードに貼り、照合する組み合わせを指定したか確認してください。
      </div>
      <div className="stage-switch article-submit">
        <div className="article-submit-row">
          <button
            type="button"
            className="btn primary"
            aria-disabled={canSubmit ? undefined : true}
            aria-describedby={reason ? 'article-submit-reason' : undefined}
            onClick={handleSubmit}
          >
            記事を提出して評価を見る
          </button>
          <button type="button" className="btn ghost" onClick={() => game.setStage('investigate')}>
            ← 調査へ戻る
          </button>
        </div>
        {reason && (
          <p id="article-submit-reason" className="article-submit-reason">
            {reason}
          </p>
        )}
      </div>
    </>
  );
}
