import { DocumentLabel } from './DocumentLabel';
import '../app/screens/document-label.css';
import { documentThumbnail, uiState } from '../data/assets';
import { documentCost, type OpenDocumentOutcome } from '../domain/budget';
import type { CaseDocument } from '../domain/types';

/** タイルの表示状態。色だけに依存せずテキストとアイコンで区別する（MVP_SPEC 12 章） */
type TileState = 'unseen' | 'locked' | 'opened';

/**
 * 読み上げ用の状態語。見た目は 既読＝チェック＋「読んだ」、未読＝印なし、
 * 開けない＝錠＋理由 1 行（#173）。読み上げは「題名、状態、コスト、理由」の順を保つ。
 */
const STATE_LABEL: Record<TileState, string> = {
  unseen: '未読',
  locked: '未読',
  opened: '調査済み',
};

const BUDGET_SHORT_TEXT = '予算不足';

function tileState(opened: boolean, outcome: OpenDocumentOutcome): TileState {
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
  outcome,
  onOpen,
  onBlocked,
}: Props) {
  const state = tileState(opened, outcome);
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
      <img className="doc-tile__thumb" src={documentThumbnail(caseId, doc.id)} alt="" />
      <DocumentLabel
        caseId={caseId}
        index={index}
        documentId={doc.id}
        visual={doc.visual}
        cost={cost}
        variant="tile"
        className="doc-tile__label"
      />
      <strong className="doc-tile__title">{doc.title}</strong>
      {state === 'opened' && (
        <span className="doc-tile__status" aria-hidden="true">
          <img className="doc-tile__icon" src={uiState('verified')} alt="" />
          読んだ
        </span>
      )}
      {/* コストはヘッダーの調査予算と同じピップ 1 個。無料は文字のみ。読み上げは aria-label 側 */}
      <span className="doc-tile__cost" aria-hidden="true">
        {cost === 0 ? (
          '無料'
        ) : (
          <span className={`v2-meter__pip doc-tile__pip${opened ? ' is-spent' : ''}`} />
        )}
      </span>
      {blocked && (
        <span className="doc-tile__reason" aria-hidden="true">
          <img className="doc-tile__icon" src={uiState('locked')} alt="" />
          {blockedText}
        </span>
      )}
    </button>
  );
}
