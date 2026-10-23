import { UI } from '../data/ui';
import { spentBudget } from '../domain/budget';
import { CASE_STATUS_LABEL, caseStatus } from '../domain/caseStatus';
import type { CaseData, CaseProgress } from '../domain/types';

export interface CaseNotebookProps {
  cases: readonly CaseData[];
  progressByCase: Record<string, CaseProgress>;
  finished: Record<string, boolean>;
}

/**
 * 事件手帳。事件ごとに進行状態と使った調査予算を記録として並べる。
 * - 提出回数は保存していないので出さない
 * - 事実（状態・予算）だけを出し、プレイヤー個人を評価・分類する文言は置かない
 */
export function CaseNotebook({ cases, progressByCase, finished }: CaseNotebookProps) {
  return (
    <div className="case-notebook">
      <ul className="case-notebook-list">
        {cases.map((c, i) => {
          const progress = progressByCase[c.id];
          const status = caseStatus(c.id, progress, finished);
          const spent = progress ? spentBudget(c, progress) : 0;
          const num = `CASE ${String(i + 1).padStart(2, '0')}`;
          return (
            <li key={c.id} className={`case-notebook-row status-${status}`}>
              <span className="case-notebook-num">{num}</span>
              <span className="case-notebook-title">{c.title}</span>
              <dl className="case-notebook-facts">
                <div>
                  <dt>状態</dt>
                  <dd className={`case-notebook-status status-${status}`}>
                    {CASE_STATUS_LABEL[status]}
                  </dd>
                </div>
                <div>
                  <dt>{UI.case.budget}</dt>
                  <dd>
                    {spent} / {c.budget}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="fine case-notebook-notice">{UI.notices.notDiagnosis}</p>
    </div>
  );
}
