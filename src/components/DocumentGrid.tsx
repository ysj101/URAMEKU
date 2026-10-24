import { documentThumbnail } from '../data/assets';
import { canOpenDocument } from '../domain/budget';
import type { CaseData, CaseProgress } from '../domain/types';

interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  onOpen: (documentId: string) => void;
}

export function DocumentGrid({ caseData, progress, onOpen }: Props) {
  return (
    <div className="document-grid">
      {caseData.documents.map((d) => {
        const opened = progress.opened.includes(d.id);
        const pinned = progress.pinned.includes(d.id);
        const openable = canOpenDocument(caseData, progress, d.id);
        const status = opened ? '調査済み' : d.cost === 0 ? '無料で確認' : `調査コスト ${d.cost}`;
        return (
          <button
            key={d.id}
            type="button"
            className="doc-tile"
            disabled={!openable}
            aria-label={`${d.title}、${opened ? '調査済み' : '未調査'}`}
            onClick={() => onOpen(d.id)}
          >
            <img src={documentThumbnail(caseData.id, d.id)} alt="" />
            <strong>{d.title}</strong>
            <span>{status}</span>
            {pinned && <span className="pin">● ボードに貼付済み</span>}
          </button>
        );
      })}
    </div>
  );
}
