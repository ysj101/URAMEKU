import { ARTICLE_LENGTH, type CaseData, type CaseProgress } from '../domain/types';

interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  onAdd: (fragmentId: string) => void;
  onRemove: (index: number) => void;
}

export function ArticleEditor({ caseData, progress, onAdd, onRemove }: Props) {
  const text = (id: string) => caseData.headline_fragments.find((f) => f.id === id)?.text ?? '';
  const full = progress.article.length >= ARTICLE_LENGTH;
  return (
    <>
      <h3 className="section-title">組み立て中の見出し</h3>
      <div className="headline-preview">
        {Array.from({ length: ARTICLE_LENGTH }, (_, i) => {
          const id = progress.article[i];
          return id ? (
            <button
              key={i}
              type="button"
              className="headline-piece filled"
              title="断片を戻す"
              onClick={() => onRemove(i)}
            >
              {text(id)}
            </button>
          ) : (
            <span key={i} className="headline-piece placeholder">
              ［断片 {i + 1}］
            </span>
          );
        })}
      </div>
      <h3 className="section-title">
        切り抜きの断片 <small>正確な内容と誤解を招く内容が混在</small>
      </h3>
      <div className="fragment-grid">
        {caseData.headline_fragments
          .filter((f) => !progress.article.includes(f.id))
          .map((f) => (
            <button
              key={f.id}
              type="button"
              className="btn ghost"
              disabled={full}
              onClick={() => onAdd(f.id)}
            >
              {f.text}
            </button>
          ))}
      </div>
    </>
  );
}
