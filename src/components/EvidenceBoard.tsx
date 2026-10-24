import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { PinCard, type PinSlot } from './PinCard';
import { c2HighresUrl, uiIcon } from '../data/assets';
import { useSound } from '../audio/useSound';
import { canUnpinDocument, type UnpinRejectReason } from '../domain/evidence';
import {
  canSelectForLink,
  isLinkComplete,
  toggleLinkSelection,
  type LinkSelectReason,
} from '../domain/link';
import type { CaseData, CaseProgress } from '../domain/types';
import '../app/screens/board.css';

/**
 * 証拠ボード（MVP-023）。タップ照合優先。
 *
 * - 採用済み資料をピンカードとして並べる。
 * - カードを 1 枚押すと「選択中（A）」、2 枚目で「照合候補（A ↔ B）」。
 *   3 枚目を押すとその 1 枚から選び直し、同じカードを再び押すと解除する
 *   （状態遷移は domain/link.ts の toggleLinkSelection）。
 * - 照合の正誤（linkStatus）は調査中は表示しない（docs/GAME_RULES.md 4 章）。
 * - ドラッグ&ドロップは実装しない。タップ・キーボードだけで同じ推理ができる。
 */
interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  onToggleLink: (documentId: string) => void;
  onUnpin: (documentId: string) => void;
}

const SELECT_REASON: Record<LinkSelectReason, string> = {
  published: '提出済みのため照合を変更できません。記事を取り下げると編集できます。',
  'not-pinned': 'ボードに採用されていない資料です。',
  'unknown-document': 'この事件には含まれていない資料です。',
};

const UNPIN_REASON: Record<UnpinRejectReason, string> = {
  published: '提出済みのためボードを変更できません。',
  'not-pinned': 'ボードに採用されていない資料です。',
  'unknown-document': 'この事件には含まれていない資料です。',
};

interface Thread {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function EvidenceBoard({ caseData, progress, onToggleLink, onUnpin }: Props) {
  const play = useSound();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [thread, setThread] = useState<Thread | null>(null);

  const titleOf = (id: string | undefined) =>
    id ? caseData.documents.find((d) => d.id === id)?.title : undefined;
  const [first, second] = progress.chosenLink;
  const complete = isLinkComplete(progress);

  const slotOf = (id: string): PinSlot | null => {
    if (id === first) return 'A';
    if (id === second) return 'B';
    return null;
  };

  const handleSelect = (id: string) => {
    if (!canSelectForLink(caseData, progress, id).ok) return;
    const next = toggleLinkSelection(caseData, progress, id);
    play(isLinkComplete(next) ? 'evidence-link' : 'ui-tap');
    onToggleLink(id);
  };

  const handleRemove = (id: string) => {
    if (!canUnpinDocument(caseData, progress, id).ok) return;
    play('ui-tap');
    onUnpin(id);
  };

  const setCardRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  // 選択中の 2 枚を結ぶ糸。カードの中心をボード座標で測る（ドラッグ不要の視覚フィードバック）。
  useLayoutEffect(() => {
    const measure = () => {
      const surface = surfaceRef.current;
      const a = first ? cardRefs.current.get(first) : undefined;
      const b = second ? cardRefs.current.get(second) : undefined;
      if (!surface || !a || !b) {
        setThread(null);
        return;
      }
      const base = surface.getBoundingClientRect();
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      setThread({
        x1: ra.left + ra.width / 2 - base.left,
        y1: ra.top + ra.height / 2 - base.top,
        x2: rb.left + rb.width / 2 - base.left,
        y2: rb.top + rb.height / 2 - base.top,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [first, second, progress.pinned]);

  const status = complete
    ? `照合候補（A ↔ B）：${titleOf(first)} ↔ ${titleOf(second)}`
    : first
      ? `選択中（A）：${titleOf(first)}。もう 1 枚押すと照合候補になります。`
      : 'カードを 2 枚順に押して照合します。';

  return (
    <section className="evidence-board" role="group" aria-label="証拠ボード">
      <h2 className="section-title">
        証拠ボード <small>カードを 2 枚押して照合（ドラッグ不要）</small>
      </h2>
      <p className="evidence-board__prompt notice" data-testid="link-prompt">
        <strong>この事件の照合：</strong>
        {caseData.link_prompt}
      </p>
      <p className="board-caption">採用した資料を並べ、2枚のつながりを赤い糸で確認。</p>
      <div
        ref={surfaceRef}
        className="evidence-board__surface"
        style={{ backgroundImage: `url(${c2HighresUrl('board')})` }}
      >
        {thread && (
          <svg className="evidence-board__thread" aria-hidden="true" data-testid="link-thread">
            <line x1={thread.x1} y1={thread.y1} x2={thread.x2} y2={thread.y2} />
          </svg>
        )}
        {progress.pinned.length === 0 ? (
          <p className="evidence-board__empty disabled-copy">
            調査した資料の「証拠ボードに貼る」を押すとここに追加されます。
          </p>
        ) : (
          <ul className="evidence-board__pins">
            {progress.pinned.map((id, index) => {
              const doc = caseData.documents.find((d) => d.id === id);
              if (!doc) return null;
              const select = canSelectForLink(caseData, progress, id);
              const unpin = canUnpinDocument(caseData, progress, id);
              return (
                <PinCard
                  key={id}
                  ref={(el) => setCardRef(id, el)}
                  document={doc}
                  index={index}
                  slot={slotOf(id)}
                  selectReason={select.ok ? null : SELECT_REASON[select.reason]}
                  removeReason={unpin.ok ? null : UNPIN_REASON[unpin.reason]}
                  onSelect={() => handleSelect(id)}
                  onRemove={() => handleRemove(id)}
                />
              );
            })}
          </ul>
        )}
      </div>
      <div className="evidence-board__status" aria-live="polite" data-testid="link-status">
        <img src={uiIcon('link')} alt="" aria-hidden="true" />
        <div>
          <strong>関係性の証明：</strong>
          <span className="evidence-board__slot">{titleOf(first) ?? '［資料Aを選択］'}</span>
          {' ↔ '}
          <span className="evidence-board__slot">{titleOf(second) ?? '［資料Bを選択］'}</span>
          <div className="fine">{status}</div>
          <div className="fine">
            異なる 2 枚の関係を提出します。正しいかどうかは提出後の評価で分かります。
          </div>
        </div>
      </div>
    </section>
  );
}
