import { useState } from 'react';
import { documentCost, remainingBudget, tryOpenDocument } from '../domain/budget';
import type { CaseData, CaseDocument, CaseProgress } from '../domain/types';
import { DocumentTile } from './DocumentTile';

interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  onOpen: (documentId: string) => void;
}

/** 開けなかった理由の文言（`role="status"` で読み上げる） */
function blockedMessage(caseData: CaseData, progress: CaseProgress, doc: CaseDocument) {
  return `「${doc.title}」は予算不足のため開けません（必要 ${documentCost(doc)}、残り ${remainingBudget(caseData, progress)}）。`;
}

export function DocumentGrid({ caseData, progress, onOpen }: Props) {
  const [blocked, setBlocked] = useState<string | null>(null);

  return (
    <>
      <div className="document-grid desk-grid">
        {caseData.documents.map((d) => (
          <DocumentTile
            key={d.id}
            caseId={caseData.id}
            document={d}
            opened={progress.opened.includes(d.id)}
            pinned={progress.pinned.includes(d.id)}
            outcome={tryOpenDocument(caseData, progress, d.id).outcome}
            onOpen={(id) => {
              setBlocked(null);
              onOpen(id);
            }}
            onBlocked={(doc) => setBlocked(blockedMessage(caseData, progress, doc))}
          />
        ))}
      </div>
      {blocked && (
        <p className="desk-status" role="status">
          {blocked}
        </p>
      )}
    </>
  );
}
