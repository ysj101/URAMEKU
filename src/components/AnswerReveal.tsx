import { fragmentFeedback, type FragmentStatus } from '../domain/article';
import type { CaseData, CaseProgress, FragmentKind } from '../domain/types';

/** スロットの採点結果の表示名 */
const FRAGMENT_STATUS_LABEL: Record<FragmentStatus, string> = {
  correct: '正しい',
  'wrong-position': '断片は正しいが位置が違う',
  incorrect: '誤り',
  empty: '未配置',
};

/** 誤り型（docs/GAME_RULES.md 6 章）の表示名 */
const FRAGMENT_KIND_LABEL: Record<FragmentKind, string> = {
  correct: '正しい断片',
  overgeneralization: '理由のない一般化',
  'misread-statistic': '統計の誤読',
  'causal-claim': '原因・結論の断定',
  'ignored-counter-evidence': '反対資料の無視',
  unverifiable: '資料から検証できない主張',
  other: 'その他の誤り',
};

/**
 * 答え合わせ（MVP-026）。「解説と正解を公開する」の明示操作のあとにだけ描画する。
 *
 * 必要資料・照合・検証メモの答え・正しい見出しに加え、自分が置いた 3 断片それぞれの
 * 採点と誤誘導理由（`fragmentFeedback`）をここで初めて見せる。
 */
export function AnswerReveal({
  caseData,
  progress,
}: {
  caseData: CaseData;
  progress: CaseProgress;
}) {
  const docTitle = (id: string) => caseData.documents.find((d) => d.id === id)?.title ?? id;
  const fragText = (id: string) => caseData.headline_fragments.find((f) => f.id === id)?.text ?? id;
  const feedback = fragmentFeedback(caseData, progress);
  const headingId = `answer-${caseData.id}`;

  return (
    <section className="answer-reveal" aria-labelledby={headingId}>
      <h3 id={headingId} className="answer-title">
        答え合わせ
      </h3>
      <dl className="answer-list">
        <div className="answer-row">
          <dt>必要な資料</dt>
          <dd>{caseData.required_evidence.map(docTitle).join('、')}</dd>
        </div>
        <div className="answer-row">
          <dt>照合する 2 資料</dt>
          <dd>{caseData.required_link.map(docTitle).join(' ↔ ')}</dd>
        </div>
        <div className="answer-row">
          <dt>数値検証メモ</dt>
          <dd>
            <ul className="answer-tasks">
              {caseData.analysis_tasks.map((t) => (
                <li key={t.id}>
                  {t.prompt}：{t.expected}
                  {t.unit}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="answer-row">
          <dt>正しい見出し</dt>
          <dd className="answer-headline">
            {caseData.correct_fragments.map(fragText).join(' ／ ')}
          </dd>
        </div>
      </dl>

      <h4 className="answer-subtitle">あなたの見出しの採点</h4>
      <ol className="fragment-feedback" aria-label="見出し断片の採点">
        {feedback.map((f) => (
          <li
            key={f.index}
            className="fragment-feedback-item"
            data-status={f.status}
            data-kind={f.kind}
          >
            <div className="fragment-feedback-head">
              <span className="fragment-feedback-slot">{f.index + 1}</span>
              <span className="fragment-feedback-text">
                {f.fragmentId ? fragText(f.fragmentId) : '（未配置）'}
              </span>
              <span className="fragment-feedback-status">{FRAGMENT_STATUS_LABEL[f.status]}</span>
            </div>
            {f.kind && f.kind !== 'correct' && (
              <p className="fragment-feedback-kind">{FRAGMENT_KIND_LABEL[f.kind]}</p>
            )}
            {f.reason && <p className="fragment-feedback-reason">{f.reason}</p>}
            {f.evidence && f.evidence.length > 0 && (
              <p className="fragment-feedback-evidence">
                根拠：{f.evidence.map(docTitle).join('、')}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
