import { useState } from 'react';
import { decisionComparisonAvailable, decisionOutcome } from '../domain/decision';
import type { V2DeskProps } from './InformationDesk';
import '../app/screens/v2.css';

export function DecisionDesk({ caseData, progress, onAction }: V2DeskProps) {
  const definition = caseData.v2?.decision;
  const records = progress.v2?.decisions ?? [];
  const [objectiveId, setObjectiveId] = useState('');
  const [optionId, setOptionId] = useState('');
  const [reason, setReason] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [counterEvidence, setCounterEvidence] = useState<string[]>([]);
  if (!definition) return null;
  const documents = caseData.documents.filter(
    (document) => progress.opened.includes(document.id) && progress.pinned.includes(document.id),
  );
  const comparisonAvailable = decisionComparisonAvailable(caseData, progress);
  const waiting = records.length > 0 && !comparisonAvailable;
  const outcome = decisionOutcome(caseData, progress);
  const selectedEvidence = evidence.filter((id) =>
    documents.some((document) => document.id === id),
  );
  const selectedCounterEvidence = counterEvidence.filter((id) =>
    documents.some((document) => document.id === id),
  );
  const valid = Boolean(
    definition.objectives.some((objective) => objective.id === objectiveId) &&
    definition.options.some(
      (option) => option.id === optionId && option.cost <= definition.resources,
    ) &&
    reason.trim() &&
    assumptions.trim() &&
    selectedEvidence.length &&
    selectedCounterEvidence.length,
  );
  const toggle = (ids: string[], id: string, checked: boolean) =>
    checked ? [...ids, id] : ids.filter((source) => source !== id);
  return (
    <section className="v2-desk" aria-label="意思決定シミュレーション">
      <h2 className="section-title">意思決定シミュレーション</h2>
      <p>{definition.prompt}</p>
      <p>行動に使える資源：{definition.resources}。調査予算とは別の制約です。</p>
      {records.length > 0 && (
        <ol className="v2-desk__history" aria-label="判断の履歴">
          {records.map((record, index) => (
            <li key={index}>
              <strong>{index === 0 ? '最初の判断' : `更新 ${index}`}：</strong>
              {definition.options.find((option) => option.id === record.optionId)?.text}
              <br />
              目的：
              {definition.objectives.find((objective) => objective.id === record.objectiveId)?.text}
              <br />
              理由：{record.reason}
              <br />
              前提：{record.assumptions}
            </li>
          ))}
        </ol>
      )}
      {waiting && (
        <p role="status">
          判断を記録しました。新たに閲覧できる資料を確認すると、方針を維持・変更できます。
        </p>
      )}
      {!waiting && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            onAction({
              type: 'v2-decision',
              record: {
                objectiveId,
                optionId,
                reason,
                assumptions,
                evidence: selectedEvidence,
                counterEvidence: selectedCounterEvidence,
              },
            });
            setReason('');
            setAssumptions('');
          }}
        >
          {records.length > 0 && <p>{definition.updatePrompt}</p>}
          <fieldset disabled={progress.published}>
            <legend>{records.length ? '追加情報を踏まえた判断' : '現在の情報での判断'}</legend>
            <label htmlFor="decision-objective">優先する目的</label>
            <select
              id="decision-objective"
              value={objectiveId}
              onChange={(event) => setObjectiveId(event.target.value)}
              required
            >
              <option value="">目的を選択</option>
              {definition.objectives.map((objective) => (
                <option key={objective.id} value={objective.id}>
                  {objective.text}
                </option>
              ))}
            </select>
            <fieldset>
              <legend>方針（選択そのものに正誤は付けません）</legend>
              {definition.options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="decision-option"
                    checked={optionId === option.id}
                    onChange={() => setOptionId(option.id)}
                    disabled={option.cost > definition.resources}
                  />
                  {option.text}（必要資源 {option.cost}
                  {option.cost > definition.resources ? '・資源不足' : ''}）
                </label>
              ))}
            </fieldset>
            <div className="v2-desk__columns">
              <fieldset>
                <legend>方針を支える資料</legend>
                {documents.map((document) => (
                  <label key={document.id}>
                    <input
                      type="checkbox"
                      checked={evidence.includes(document.id)}
                      disabled={counterEvidence.includes(document.id)}
                      onChange={(event) =>
                        setEvidence(toggle(evidence, document.id, event.target.checked))
                      }
                    />
                    {document.title}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>反対の見方・制約を示す資料</legend>
                {documents.map((document) => (
                  <label key={document.id}>
                    <input
                      type="checkbox"
                      checked={counterEvidence.includes(document.id)}
                      disabled={evidence.includes(document.id)}
                      onChange={(event) =>
                        setCounterEvidence(
                          toggle(counterEvidence, document.id, event.target.checked),
                        )
                      }
                    />
                    {document.title}
                  </label>
                ))}
              </fieldset>
            </div>
            {documents.length < 2 && (
              <p>異なる資料を少なくとも2件読み、証拠ボードに採用してください。</p>
            )}
            <label htmlFor="decision-assumptions">この判断が成り立つ前提・不確実な点</label>
            <textarea
              id="decision-assumptions"
              value={assumptions}
              onChange={(event) => setAssumptions(event.target.value)}
              maxLength={2000}
              required
            />
            <label htmlFor="decision-reason">目的と根拠を踏まえた選択理由</label>
            <textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={2000}
              required
            />
            <button type="submit" className="btn primary" disabled={!valid}>
              判断を記録
            </button>
          </fieldset>
        </form>
      )}
      {outcome && (
        <div>
          <h3>記録した方針の条件付き結果</h3>
          <p>{outcome.option.outcome}</p>
          <p>{outcome.option.tradeoff}</p>
          <p>
            結果の良し悪しから、判断が正しかったかを逆算しません。当時分かっていた情報と前提を振り返ってください。
          </p>
          <details>
            <summary>選ばなかった方針の想定（反実仮想）</summary>
            {outcome.counterfactuals.map((option) => (
              <p key={option.id}>
                <strong>{option.text}：</strong>
                {option.outcome} {option.tradeoff}
              </p>
            ))}
          </details>
        </div>
      )}
    </section>
  );
}
