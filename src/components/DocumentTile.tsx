import { VISUAL_LABEL } from './documentVisuals';
import { DocumentLabel } from './DocumentLabel';
import '../app/screens/document-label.css';
import { documentThumbnail, uiState, type UiStateName } from '../data/assets';
import { documentCost, type OpenDocumentOutcome } from '../domain/budget';
import type { CaseDocument } from '../domain/types';

/** タイルの表示状態。色だけに依存せずテキストとアイコンで区別する（MVP_SPEC 12 章） */
type TileState = 'unseen' | 'locked' | 'opened' | 'pinned';

const STATE_ICON: Record<TileState, UiStateName> = {
  unseen: 'unseen',
  locked: 'locked',
  opened: 'investigate',
  pinned: 'verified',
};

const STATE_LABEL: Record<TileState, string> = {
  unseen: '未調査',
  locked: '未調査',
  opened: '調査済み',
  pinned: '採用済み',
};

const BUDGET_SHORT_TEXT = '予算不足';

function tileState(opened: boolean, pinned: boolean, outcome: OpenDocumentOutcome): TileState {
  if (pinned) return 'pinned';
  if (opened) return 'opened';
  if (outcome === 'insufficient-budget' || outcome === 'sealed') return 'locked';
  return 'unseen';
}

interface Props {
  caseId: string;
  /** 事件内の資料番号（0 始まり） */
  index: number;
  document: CaseDocument;
  opened: boolean;
  pinned: boolean;
  /** `tryOpenDocument` の結果。`insufficient-budget` のときは開かず理由を告げる */
  outcome: OpenDocumentOutcome;
  onOpen: (documentId: string) => void;
  /** 開けないときに呼ぶ（理由の読み上げ用） */
  onBlocked: (document: CaseDocument, outcome: OpenDocumentOutcome) => void;
}

export function DocumentTile({
  caseId,
  index,
  document: doc,
  opened,
  pinned,
  outcome,
  onOpen,
  onBlocked,
}: Props) {
  const state = tileState(opened, pinned, outcome);
  const blocked = state === 'locked';
  const blockedText = outcome === 'sealed' ? '初回の判断を記録すると開示' : BUDGET_SHORT_TEXT;
  const cost = documentCost(doc);
  const costText = opened ? '再読は無料' : cost === 0 ? '無料で確認' : `調査コスト ${cost}`;
  const label = `${doc.title}、${STATE_LABEL[state]}、${costText}${blocked ? `、${blockedText}` : ''}`;

  return (
    <button
      type="button"
      className={`doc-tile doc-tile--${state}`}
      data-state={state}
      data-visual={doc.visual}
      aria-disabled={blocked || undefined}
      aria-label={label}
      onClick={() => (blocked ? onBlocked(doc, outcome) : onOpen(doc.id))}
    >
      <span className="doc-tile__kind" aria-hidden="true">
        {VISUAL_LABEL[doc.visual]}
      </span>
      <img className="doc-tile__thumb" src={documentThumbnail(caseId, doc.id)} alt="" />
      <DocumentLabel
        caseId={caseId}
        index={index}
        documentId={doc.id}
        visual={doc.visual}
        cost={cost}
        className="doc-tile__label"
      />
      <strong className="doc-tile__title">{doc.title}</strong>
      <span className="doc-tile__status">
        <img
          className="doc-tile__icon"
          src={uiState(STATE_ICON[state])}
          alt=""
          aria-hidden="true"
        />
        {STATE_LABEL[state]}
      </span>
      <span className="doc-tile__cost">{costText}</span>
      {blocked && <span className="doc-tile__reason">{blockedText}</span>}
    </button>
  );
}
