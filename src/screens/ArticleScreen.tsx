import { ArticleEditor } from '../components/ArticleEditor';
import { canSubmitArticle } from '../domain/publish';
import type { GameApi } from '../state/useGame';

export function ArticleScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const filledCalcs = Object.values(progress.calculations).filter((v) => v !== '').length;
  return (
    <>
      <div className="meter">
        <span>STEP 02 / 記事を組み立てる</span>
        <span>
          採用証拠 {progress.pinned.length} 件 / 検証メモ {filledCalcs} 件
        </span>
      </div>
      <div className="article-top">
        事件を裏付ける資料を証拠ボードに貼り、2枚の照合関係を示したうえで記事を提出します。下の断片8個から、
        <strong>正確な見出しを構成する3つ</strong>を順番に選びます（任意の断片は撤回できます）。
      </div>
      <ArticleEditor
        caseData={current}
        progress={progress}
        onAdd={(fragmentId) => dispatch({ type: 'add-fragment', fragmentId })}
        onRemove={(index) => dispatch({ type: 'remove-fragment', index })}
      />
      <div className="notice">
        資料を調査しただけでは根拠になりません。証拠ボードに貼り、照合する組み合わせを指定したか確認してください。
      </div>
      <div className="stage-switch">
        <button
          type="button"
          className="btn primary"
          disabled={!canSubmitArticle(progress)}
          onClick={() => dispatch({ type: 'submit' })}
        >
          記事を提出して評価を見る
        </button>
        <button type="button" className="btn ghost" onClick={() => game.setStage('investigate')}>
          ← 調査へ戻る
        </button>
      </div>
    </>
  );
}
