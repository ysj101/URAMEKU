import type { CaseData, CaseProgress } from '../domain/types';

interface Props {
  caseData: CaseData;
  progress: CaseProgress;
  onChange: (taskId: string, value: string) => void;
}

export function CalculationDesk({ caseData, progress, onChange }: Props) {
  return (
    <>
      <h3 className="section-title">
        検証メモ <small>数字は自分で資料から計算する</small>
      </h3>
      <div className="calculation-desk">
        {caseData.analysis_tasks.map((task) => (
          <label key={task.id} className="calc-field">
            <strong>{task.prompt}</strong>
            <span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="数値を入力"
                value={progress.calculations[task.id] ?? ''}
                aria-label={task.prompt}
                onChange={(e) => onChange(task.id, e.target.value)}
              />{' '}
              {task.unit}
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
