import type { CaseData, CaseProgress } from '../domain/types';

interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  onToggleLink: (documentId: string) => void;
}

export function EvidenceBoard({ caseData, progress, onToggleLink }: Props) {
  const title = (id: string | undefined) =>
    id ? caseData.documents.find((d) => d.id === id)?.title : undefined;
  const [first, second] = progress.chosenLink;
  return (
    <>
      <h3 className="section-title">
        証拠ボード <small>資料をピン留めして2枚を照合</small>
      </h3>
      <div className="board">
        <div className="pins">
          {progress.pinned.length === 0 ? (
            <span className="disabled-copy">
              調査した資料の「証拠ボードに貼る」を押すとここに追加されます。
            </span>
          ) : (
            progress.pinned.map((id) => (
              <button
                key={id}
                type="button"
                className={`pin-card ${progress.chosenLink.includes(id) ? 'selected' : ''}`}
                aria-pressed={progress.chosenLink.includes(id)}
                onClick={() => onToggleLink(id)}
              >
                <b>●</b> {title(id)}
              </button>
            ))
          )}
        </div>
        <div className="link-slot">
          <strong>関係性の証明：</strong>
          {title(first) ?? '［資料Aを選択］'}
          {' ↔ '}
          {title(second) ?? '［資料Bを選択］'}
          <div className="fine">
            証拠カードを2枚順に押して照合。異なる2枚の関係を提出する必要があります。
          </div>
        </div>
      </div>
    </>
  );
}
