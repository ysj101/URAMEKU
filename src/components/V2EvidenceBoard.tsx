import { useLayoutEffect, useRef, useState } from 'react';
import type { V2EvidenceLink, V2Relation } from '../domain/types';
import { sameEvidenceLink } from '../domain/link';
import type { V2DeskProps } from './InformationDesk';
import '../app/screens/v2.css';

const V2_RELATION_LABEL: Record<V2Relation, string> = {
  supports: '補強する',
  contradicts: '反証する',
  qualifies: '適用範囲・条件を補う',
  sequence: '時系列でつながる',
};

export function V2EvidenceBoard({ caseData, progress, onAction }: V2DeskProps) {
  const pendingFocus = useRef<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [relation, setRelation] = useState<V2Relation>('supports');
  const documents = caseData.documents.filter(
    (document) => progress.pinned.includes(document.id) && progress.opened.includes(document.id),
  );
  const links = [...(progress.v2?.links ?? [])].sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.relation.localeCompare(b.relation),
  );
  const title = (id: string) =>
    caseData.documents.find((document) => document.id === id)?.title ?? id;
  useLayoutEffect(() => {
    if (pendingFocus.current) document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [links]);
  const current = { from, to, relation };
  const exists = links.some((link) => sameEvidenceLink(link, current));
  const valid =
    from &&
    to &&
    from !== to &&
    documents.some((document) => document.id === from) &&
    documents.some((document) => document.id === to);
  const updateRelation = (link: V2EvidenceLink, value: V2Relation, focusId: string) => {
    pendingFocus.current = focusId;
    if (link.relation === value) return;
    onAction({ type: 'v2-link', link });
    const updated = { ...link, relation: value };
    if (!links.some((candidate) => sameEvidenceLink(candidate, updated)))
      onAction({ type: 'v2-link', link: updated });
  };
  return (
    <section className="v2-desk evidence-board" role="group" aria-label="証拠ボード">
      <h2 className="section-title">
        証拠ボード <small>根拠の関係を記録する</small>
      </h2>
      <p data-testid="link-prompt">
        <strong>この事件の照合：</strong>
        {caseData.v2?.graph.prompt ?? caseData.link_prompt}
      </p>
      <p>
        資料のつながりと役割を記録してください。複数の関係を作れます。調査中に正答は表示しません。
      </p>
      <ul aria-label="採用した資料">
        {documents.map((document) => (
          <li key={document.id}>
            {document.title}{' '}
            <button
              type="button"
              className="btn ghost"
              disabled={progress.published}
              onClick={() => onAction({ type: 'toggle-pin', documentId: document.id })}
              aria-label={`${document.title} をボードから外す`}
            >
              外す
            </button>
          </li>
        ))}
      </ul>
      {documents.length < 2 && (
        <p>資料を少なくとも2件読み、証拠ボードに採用すると関係を記録できます。</p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !exists) onAction({ type: 'v2-link', link: current });
        }}
      >
        <fieldset disabled={progress.published}>
          <legend>新しい関係</legend>
          <label htmlFor="v2-link-from">起点となる資料</label>
          <select id="v2-link-from" value={from} onChange={(event) => setFrom(event.target.value)}>
            <option value="">資料を選択</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
          </select>
          <label htmlFor="v2-link-relation">関係の役割</label>
          <select
            id="v2-link-relation"
            value={relation}
            onChange={(event) => setRelation(event.target.value as V2Relation)}
          >
            {Object.entries(V2_RELATION_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor="v2-link-to">結び付ける資料</label>
          <select id="v2-link-to" value={to} onChange={(event) => setTo(event.target.value)}>
            <option value="">資料を選択</option>
            {documents
              .filter((document) => document.id !== from)
              .map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
          </select>
          <button type="submit" className="btn primary" disabled={!valid || exists}>
            {exists ? 'この関係は記録済み' : '関係を追加'}
          </button>
        </fieldset>
      </form>
      <ul aria-label="記録した関係">
        {links.map((link, index) => (
          <li key={`${link.from}:${link.to}:${link.relation}`}>
            <strong>
              {title(link.from)} → {title(link.to)}
            </strong>
            <label htmlFor={`v2-role-${index}`}>関係 {index + 1} の役割</label>
            <select
              id={`v2-role-${index}`}
              disabled={progress.published}
              value={link.relation}
              onChange={(event) =>
                updateRelation(link, event.target.value as V2Relation, event.currentTarget.id)
              }
            >
              {Object.entries(V2_RELATION_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ghost"
              disabled={progress.published}
              onClick={() => onAction({ type: 'v2-link', link })}
              aria-label={`${title(link.from)} から ${title(link.to)} の関係を削除`}
            >
              関係を削除
            </button>
          </li>
        ))}
      </ul>
      <p aria-live="polite">{links.length} 件の関係を記録済み</p>
    </section>
  );
}
