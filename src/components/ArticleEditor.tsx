import { useState } from 'react';
import { ARTICLE_LENGTH, type CaseData, type CaseProgress } from '../domain/types';
import { PaperCard } from './PaperCard';

/**
 * 見出し編集（MVP-025）。
 *
 * - 3 スロットの見出しプレビュー。スロットをタップすると断片一覧がそのスロットへの
 *   「差し替え」モードになる（もう一度タップで解除）。「↑ ↓」で順序入れ替え、「外す」で撤回。
 * - 断片一覧は使用中のものも消さず、`aria-disabled` と「使用中（断片 n）」で示す。
 * - 提出前に正誤を漏らさないため、`fragmentFeedback` はここでは使わない。
 */
export interface ArticleEditorProps {
  caseData: CaseData;
  progress: CaseProgress;
  onAdd: (fragmentId: string) => void;
  onRemove: (index: number) => void;
  onReplace: (index: number, fragmentId: string) => void;
  onMove: (from: number, to: number) => void;
  onClear: () => void;
}

export function ArticleEditor({
  caseData,
  progress,
  onAdd,
  onRemove,
  onReplace,
  onMove,
  onClear,
}: ArticleEditorProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const { article } = progress;
  const text = (id: string) => caseData.headline_fragments.find((f) => f.id === id)?.text ?? '';
  const full = article.length >= ARTICLE_LENGTH;
  const missing = ARTICLE_LENGTH - article.length;
  // 対象スロットは「埋まっているスロット」か「次に埋まる空スロット」だけ有効
  const target = selected !== null && selected <= article.length ? selected : null;

  const toggleSlot = (index: number) => setSelected((prev) => (prev === index ? null : index));

  const choose = (fragmentId: string) => {
    if (article.includes(fragmentId)) return;
    if (target !== null) {
      onReplace(target, fragmentId);
      setSelected(null);
      return;
    }
    if (full) return;
    onAdd(fragmentId);
  };

  const hint =
    target !== null
      ? `断片 ${target + 1} を差し替えます。下の一覧から断片を選んでください（スロットをもう一度タップすると解除）。`
      : full
        ? '3 つ揃いました。差し替えるには見出しのスロットをタップしてください。'
        : `あと ${missing} 個、下の一覧から選んでください。`;

  return (
    <>
      <h2 className="section-title">組み立て中の見出し</h2>
      <div
        className="headline-preview article-slots"
        role="group"
        aria-label="組み立て中の見出し（3 スロット）"
      >
        {Array.from({ length: ARTICLE_LENGTH }, (_, i) => {
          const id = article[i];
          const isTarget = target === i;
          const nextEmpty = id === undefined && i === article.length;
          return (
            <div key={i} className={`article-slot${isTarget ? ' is-target' : ''}`}>
              <span className="article-slot-number" aria-hidden="true">
                {i + 1}
              </span>
              {id !== undefined ? (
                <button
                  type="button"
                  className="headline-piece filled article-slot-piece"
                  aria-pressed={isTarget}
                  aria-label={`断片 ${i + 1}: ${text(id)}（タップで差し替え）`}
                  onClick={() => toggleSlot(i)}
                >
                  {text(id)}
                </button>
              ) : (
                <button
                  type="button"
                  className="headline-piece placeholder article-slot-piece"
                  aria-pressed={isTarget}
                  aria-disabled={nextEmpty ? undefined : true}
                  aria-label={`断片 ${i + 1}（空）`}
                  onClick={() => nextEmpty && toggleSlot(i)}
                >
                  ［断片 {i + 1}］
                </button>
              )}
              {id !== undefined && (
                <div className="article-slot-actions">
                  <button
                    type="button"
                    className="btn ghost article-slot-action"
                    aria-label={`断片 ${i + 1} を前へ`}
                    disabled={i === 0}
                    onClick={() => onMove(i, i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ghost article-slot-action"
                    aria-label={`断片 ${i + 1} を後ろへ`}
                    disabled={i === article.length - 1}
                    onClick={() => onMove(i, i + 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn ghost article-slot-action"
                    aria-label={`断片 ${i + 1} を外す`}
                    onClick={() => {
                      setSelected(null);
                      onRemove(i);
                    }}
                  >
                    外す
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="article-edit-bar">
        <p className="article-edit-hint" role="status">
          {hint}
        </p>
        <button
          type="button"
          className="btn ghost article-clear"
          aria-disabled={article.length === 0 ? true : undefined}
          onClick={() => {
            if (article.length === 0) return;
            setSelected(null);
            onClear();
          }}
        >
          この見出しをクリア
        </button>
      </div>
      <h2 className="section-title">
        切り抜きの断片 <small>正確な内容と誤解を招く内容が混在</small>
      </h2>
      <ul className="fragment-grid fragment-list" aria-label="切り抜きの断片">
        {caseData.headline_fragments.map((f) => {
          const usedAt = article.indexOf(f.id);
          const used = usedAt >= 0;
          const blocked = !used && target === null && full;
          return (
            <li key={f.id} className="fragment-list-item">
              <PaperCard
                enter="place"
                tone={used ? 'aged' : 'white'}
                className={`fragment-card${used ? ' is-used' : ''}`}
              >
                <button
                  type="button"
                  className="fragment-card-button"
                  aria-disabled={used || blocked ? true : undefined}
                  onClick={() => choose(f.id)}
                >
                  <span className="fragment-card-text">{f.text}</span>
                  {used && <span className="fragment-card-state">使用中（断片 {usedAt + 1}）</span>}
                </button>
              </PaperCard>
            </li>
          );
        })}
      </ul>
    </>
  );
}
