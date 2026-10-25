import { useState } from 'react';
import {
  comparisonAvailable,
  experimentComparison,
  experimentCondition,
} from '../domain/experiment';
import type { V2DeskProps } from './InformationDesk';
import '../app/screens/v2.css';

export function ExperimentDesk({ caseData, progress, onAction }: V2DeskProps) {
  const definition = caseData.v2?.experiment;
  const record = progress.v2?.experiment;
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  if (!definition) return null;
  const initial = !record?.initialChoice;
  const condition = experimentCondition(definition, progress);
  const compared = experimentComparison(caseData, progress);
  const canCompare = comparisonAvailable(caseData, progress);
  const finished = record?.stage === 'complete';
  return (
    <section className="v2-desk" aria-label="見え方のミニ実験">
      <h2 className="section-title">見え方のミニ実験</h2>
      <p>{definition.prompt}</p>
      {initial ? (
        <div>
          <h3>{condition?.label}</h3>
          <p>{condition?.prompt}</p>
          <fieldset disabled={progress.published}>
            <legend>今ある情報での判断</legend>
            {definition.choices.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="btn ghost"
                onClick={() => onAction({ type: 'v2-experiment-initial', choiceId: candidate.id })}
              >
                {candidate.text}
              </button>
            ))}
          </fieldset>
        </div>
      ) : (
        <>
          <p>
            <strong>最初の判断：</strong>
            {compared?.initial}
          </p>
          {!canCompare && (
            <p role="status">
              比較の段階です。新たに閲覧できる調査資料を読んでから、もう一度判断してください。
            </p>
          )}
          {canCompare && !finished && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (choice && reason.trim())
                  onAction({ type: 'v2-experiment-update', choiceId: choice, reason });
              }}
            >
              <h3>提示条件を比べる</h3>
              <ul>
                {definition.conditions.map((candidate) => (
                  <li key={candidate.id}>
                    <strong>{candidate.label}：</strong>
                    {candidate.prompt}
                  </li>
                ))}
              </ul>
              <p>{definition.comparisonPrompt}</p>
              <fieldset disabled={progress.published}>
                <legend>比較後の判断（変わらなくても構いません）</legend>
                {definition.choices.map((candidate) => (
                  <label key={candidate.id}>
                    <input
                      type="radio"
                      name="experiment-updated-choice"
                      checked={choice === candidate.id}
                      onChange={() => setChoice(candidate.id)}
                    />
                    {candidate.text}
                  </label>
                ))}
                <label htmlFor={`experiment-reason-${definition.id}`}>維持・変更した理由</label>
                <textarea
                  id={`experiment-reason-${definition.id}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={2000}
                  required
                />
                <button className="btn primary" type="submit" disabled={!choice || !reason.trim()}>
                  比較後の判断を記録
                </button>
              </fieldset>
            </form>
          )}
          {finished && (
            <div role="status">
              <p>
                <strong>比較後の判断：</strong>
                {compared?.updated}
              </p>
              <p>{record.reason}</p>
              <p>最初と比較後の判断を記録しました。反応の違いに正誤は付けません。</p>
            </div>
          )}
        </>
      )}
      <p className="fine">
        これは見え方を振り返るための小さな体験です。一度の反応から性格や能力を診断することはできません。記録はこの端末に保存します。
      </p>
    </section>
  );
}
