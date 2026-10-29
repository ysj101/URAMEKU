import { UI } from '../data/ui';
import type { CaseData } from '../domain/types';

/**
 * 編集後記（MVP-026）。事件の認知バイアスの解説と持ち帰る視点を示す。
 *
 * - 事件の `disclaimer`（架空注記）と、`UI.notices.notDiagnosis` の注記を必ず添える。
 * - 事件内の判断を扱うものであり、プレイヤー個人の評価には踏み込まない。
 */
export function Debrief({
  caseData,
  collapsible = false,
}: {
  caseData: CaseData;
  collapsible?: boolean;
}) {
  const headingId = `debrief-${caseData.id}`;
  const content = (
    <>
      <h3 id={headingId} className="debrief-title">
        <span className="debrief-kicker">編集後記</span>
        {caseData.bias}
      </h3>
      <p className="debrief-explanation">{caseData.debrief.explanation}</p>
      <p className="debrief-takeaway">
        <strong>持ち帰る視点：</strong>
        {caseData.debrief.takeaway}
      </p>
    </>
  );
  return (
    <section className="debrief" aria-labelledby={headingId}>
      {collapsible ? (
        <details className="case-guide-details">
          <summary>編集後記を読む</summary>
          {content}
        </details>
      ) : (
        content
      )}
      <p className="debrief-scope">
        この解説は事件の中での判断の流れを扱うものです。{UI.notices.notDiagnosis}
      </p>
      <p className="debrief-disclaimer" data-testid="case-disclaimer">
        {caseData.disclaimer}
      </p>
    </section>
  );
}
