import { useId, useState } from 'react';
import { interpretInput } from '../domain/calculation';
import type { CaseData, CaseProgress } from '../domain/types';
import { NumericField, issueMessage } from './NumericField';
import '../app/screens/calc.css';

/**
 * 検証メモ（計算デスク）。MVP-024 で全面刷新。
 *
 * - 各問を `fieldset`/`legend` でまとめ、単位を添える。「どの資料の数字を使うか」は書かない。
 * - 入力済み件数を表示し、「入力内容を確認」で 2 問の正規化値を一覧できる（正誤は出さない）。
 * - 提出済み（`progress.published`）のときは読み取り専用にし、記事の修正へ誘導する。
 */
interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  /** 生の入力をそのまま `set-calculation` に渡す */
  onChange: (taskId: string, value: string) => void;
}

export function CalculationDesk({ caseData, progress, onChange }: Props) {
  const panelId = useId();
  const [reviewing, setReviewing] = useState(false);
  const readOnly = progress.published;
  const tasks = caseData.analysis_tasks;

  const rows = tasks.map((task) => {
    const raw = progress.calculations[task.id] ?? '';
    return { task, raw, interpreted: interpretInput(raw, task) };
  });
  const filled = rows.filter((r) => r.interpreted.value !== null).length;
  const problems = rows.filter((r) => r.interpreted.value === null);

  return (
    <section className="calc-desk" aria-labelledby={`${panelId}-title`}>
      <h3 className="section-title" id={`${panelId}-title`}>
        検証メモ{' '}
        <small>
          {filled} / {tasks.length} 件入力済み
        </small>
      </h3>
      <p className="calc-desk__lead">
        数字は資料から自分で計算して書きます。全角やカンマ、単位付きでも読み取れます。
      </p>
      {readOnly && (
        <p className="calc-desk__locked" role="status">
          記事は提出済みのため、検証メモは変更できません。数字を直したいときは記事を修正してください。
        </p>
      )}
      <div className="calc-desk__grid">
        {rows.map(({ task, raw }, index) => (
          <fieldset key={task.id} className="calc-desk__item" disabled={readOnly}>
            <legend className="calc-desk__legend">
              問 {index + 1}
              <span className="calc-desk__unit-note">（単位: {task.unit}）</span>
            </legend>
            <NumericField
              label={task.prompt}
              task={task}
              value={raw}
              readOnly={readOnly}
              name={`calc-${task.id}`}
              onChange={(value) => onChange(task.id, value)}
            />
          </fieldset>
        ))}
      </div>
      <div className="calc-desk__actions">
        <button
          type="button"
          className="btn secondary"
          aria-expanded={reviewing}
          aria-controls={`${panelId}-review`}
          onClick={() => setReviewing((v) => !v)}
        >
          {reviewing ? '確認を閉じる' : '入力内容を確認'}
        </button>
      </div>
      {reviewing && (
        <div
          id={`${panelId}-review`}
          className={`calc-desk__review${problems.length ? ' has-problems' : ''}`}
          role={problems.length ? 'alert' : 'status'}
        >
          <p className="calc-desk__review-title">
            {problems.length
              ? `未入力、または数値として読めない問いが ${problems.length} 件あります。記事に進む前に見直してください。`
              : 'すべての問いを数値として読み取れました。この数字で記事を組み立てます。'}
          </p>
          <dl className="calc-desk__review-list">
            {rows.map(({ task, interpreted }, index) => (
              <div key={task.id} className="calc-desk__review-row">
                <dt>
                  問 {index + 1}: {task.prompt}
                </dt>
                <dd>
                  {interpreted.issue === 'empty'
                    ? '未入力'
                    : interpreted.value === null
                      ? issueMessage(interpreted.issue)
                      : `${interpreted.normalized} ${task.unit}`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
