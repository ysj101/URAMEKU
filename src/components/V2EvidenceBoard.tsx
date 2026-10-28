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

/** 役割ごとの意味。A = 起点の資料、B = 結び付ける資料 */
const V2_RELATION_HELP: Record<V2Relation, string> = {
  supports: 'A に書いてあることが、B の数字や主張を支える',
  contradicts: 'A に書いてあることが、B の数字や主張と食い違う',
  qualifies: 'A が、B が成り立つ範囲・前提・条件をしぼる',
  sequence: 'A のあとに B が起きた、または A が B の前の段階になる',
};

/** 「A は B を〜」の形で読める 1 文にする */
export function describeLink(from: string, to: string, relation: V2Relation): string {
  const a = `「${from}」`;
  const b = `「${to}」`;
  switch (relation) {
    case 'supports':
      return `${a} は ${b} を補強する`;
    case 'contradicts':
      return `${a} は ${b} を反証する`;
    case 'qualifies':
      return `${a} は ${b} の適用範囲・条件を補う`;
    case 'sequence':
      return `${a} から ${b} へ時系列でつながる`;
  }
}

export function V2EvidenceBoard({ caseData, progress, onAction }: V2DeskProps) {
  const pendingFocus = useRef<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [relation, setRelation] = useState<V2Relation>('supports');
  const documents = caseData.documents.filter((document) => progress.opened.includes(document.id));
  const links = [...(progress.v2?.links ?? [])].sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.relation.localeCompare(b.relation),
  );
  const title = (id: string) =>
    caseData.documents.find((document) => document.id === id)?.title ?? id;
  const paths = caseData.v2?.graph.paths ?? [];
  const target = paths.length ? Math.min(...paths.map((path) => path.length)) : 0;
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
  const preview = valid
    ? describeLink(title(from), title(to), relation)
    : from && !to
      ? `「${title(from)}」 は …（結び付ける資料を選んでください）`
      : '資料を 2 つ選ぶと、その関係がここに 1 文で表示されます。';
  return (
    <section className="v2-desk evidence-board" role="group" aria-label="証拠ボード">
      <h2 className="section-title">
        証拠ボード <small>資料どうしの関係を 1 文ずつ記録する</small>
      </h2>
      <p data-testid="link-prompt">
        <strong>この事件の照合：</strong>
        {caseData.v2?.graph.prompt ?? caseData.link_prompt}
      </p>
      <ol className="evidence-board__steps" aria-label="関係の記録手順">
        <li>
          <strong>起点の資料 A</strong> を選ぶ
        </li>
        <li>
          <strong>結び付ける資料 B</strong> を選ぶ
        </li>
        <li>
          A が B に対して<strong>どんな役割か</strong>を選び、「関係を追加」
        </li>
      </ol>
      <p className="v2-desk__lead">
        {target > 0 && `この事件では、関係を ${target} 件以上残すのが目安です。`}
        同じ 2
        つの資料に、別の役割を付けてもかまいません。どの関係が合っているかは、調査中には表示しません。
      </p>
      <p aria-live="polite">
        {documents.length < 2
          ? '資料を 2 件以上読むと、関係を記録できるようになります。'
          : `読んだ資料 ${documents.length} 件から選べます。`}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !exists) onAction({ type: 'v2-link', link: current });
        }}
      >
        <fieldset disabled={progress.published}>
          <legend>新しい関係</legend>
          <div className="evidence-board__pair">
            <div>
              <label htmlFor="v2-link-from">A：起点となる資料</label>
              <select
                id="v2-link-from"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              >
                <option value="">資料を選択</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="v2-link-to">B：結び付ける資料</label>
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
            </div>
          </div>
          <label htmlFor="v2-link-relation">A は B に対して…（関係の役割）</label>
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
          <dl className="evidence-board__roles" aria-label="役割の意味">
            {(Object.keys(V2_RELATION_LABEL) as V2Relation[]).map((id) => (
              <div key={id} className={id === relation ? 'is-current' : ''}>
                <dt>{V2_RELATION_LABEL[id]}</dt>
                <dd>{V2_RELATION_HELP[id]}</dd>
              </div>
            ))}
          </dl>
          <p className="evidence-board__preview" data-testid="link-preview" aria-live="polite">
            <span className="evidence-board__preview-label">追加される関係：</span>
            {preview}
          </p>
          <button type="submit" className="btn primary" disabled={!valid || exists}>
            {exists ? 'この関係は記録済み' : '関係を追加'}
          </button>
        </fieldset>
      </form>
      <ul aria-label="記録した関係" className="evidence-board__links">
        {links.map((link, index) => (
          <li key={`${link.from}:${link.to}:${link.relation}`}>
            <strong>{describeLink(title(link.from), title(link.to), link.relation)}</strong>
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
      <p aria-live="polite">
        {links.length} 件の関係を記録済み
        {target > 0 && links.length < target && `（目安まであと ${target - links.length} 件）`}
      </p>
    </section>
  );
}
