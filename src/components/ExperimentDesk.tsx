import { createV2Progress } from '../domain/v2Progress';
import {
  comparisonAvailable,
  experimentComparison,
  experimentCondition,
} from '../domain/experiment';
import type { V2DeskProps } from './InformationDesk';
import { MissingList, RequiredMark } from './RequiredMark';
import { useDraft } from './useDraft';
import '../app/screens/v2.css';

export function ExperimentDesk({ caseData, progress, onAction }: V2DeskProps) {
  const definition = caseData.v2?.experiment;
  const record = progress.v2?.experiment;
  // 比較後の判断の入力は下書きとして残す
  const [draft, setDraft, clearDraft] = useDraft(`experiment:${caseData.id}`, () => ({
    choice: '',
    reason: '',
  }));
  const { choice, reason } = draft;
  if (!definition) return null;
  const missing = [!choice && '判断', !reason.trim() && '理由'].filter((item): item is string =>
    Boolean(item),
  );
  const ui = definition.ui;
  const initial = !record?.initialChoice;
  const condition = experimentCondition(
    definition,
    progress,
    createV2Progress(caseData).experiment?.conditionId,
  );
  const compared = experimentComparison(caseData, progress);
  const canCompare = comparisonAvailable(caseData, progress);
  const finished = record?.stage === 'complete';
  return (
    <section className="v2-desk" aria-label="見え方のミニ実験">
      <h2 className="section-title">見え方のミニ実験</h2>
      <p>{definition.prompt}</p>
      {definition.scenario && <p>{definition.scenario}</p>}
      {initial ? (
        <div>
          <h3>{condition?.label}</h3>
          <p>{condition?.prompt}</p>
          <fieldset disabled={progress.published}>
            <legend>{ui?.initialLegend ?? '今ある情報での判断'}</legend>
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
            <strong>{ui?.initialLabel ?? '最初の判断：'}</strong>
            {compared?.initial}
          </p>
          {!canCompare && (
            <p role="status">
              {ui?.waiting ??
                'ここからは比べる段階です。新しく開けるようになった調査資料を読んでから、もう一度判断してください。'}
            </p>
          )}
          {canCompare && !finished && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (missing.length) return;
                onAction({ type: 'v2-experiment-update', choiceId: choice, reason });
                clearDraft();
              }}
            >
              <h3>{ui?.comparisonTitle ?? '提示条件を比べる'}</h3>
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
                <legend>
                  {ui?.comparisonLegend ?? '比較後の判断（変わらなくても構いません）'}
                  <RequiredMark />
                </legend>
                {definition.choices.map((candidate) => (
                  <label key={candidate.id}>
                    <input
                      type="radio"
                      name="experiment-updated-choice"
                      checked={choice === candidate.id}
                      onChange={() => setDraft((prev) => ({ ...prev, choice: candidate.id }))}
                    />
                    {candidate.text}
                  </label>
                ))}
                <label htmlFor={`experiment-reason-${definition.id}`}>
                  {ui?.reasonLabel ?? '維持・変更した理由'}
                  <RequiredMark />
                </label>
                <textarea
                  id={`experiment-reason-${definition.id}`}
                  value={reason}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  maxLength={2000}
                  required
                />
                <MissingList items={missing} />
                <button className="btn primary" type="submit" disabled={missing.length > 0}>
                  {ui?.comparisonSubmit ?? '比較後の判断を記録'}
                </button>
              </fieldset>
            </form>
          )}
          {finished && (
            <>
              <div role="status">
                <p>
                  <strong>{ui?.updatedLabel ?? '比較後の判断：'}</strong>
                  {compared?.updated}
                </p>
                <p>{record.reason}</p>
                <p>
                  {ui?.complete ??
                    '最初の判断と、比べたあとの判断を記録しました。反応の違いに、正解・不正解は付けません。'}
                </p>
              </div>
              {definition.column && (
                <aside aria-label={definition.column.title}>
                  <p>{definition.explanation}</p>
                  <h3>{definition.column.title}</h3>
                  {definition.column.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <ul>
                    {definition.column.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </>
          )}
        </>
      )}
      <p className="fine">
        {ui?.privacy ??
          'これは、情報の見え方をふり返るための小さな体験です。一度の反応だけで、その人の特徴を決めつけることはしません。記録はこの端末に保存します。'}
      </p>
    </section>
  );
}
