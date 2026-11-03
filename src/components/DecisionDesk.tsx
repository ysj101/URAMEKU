import { decisionComparisonAvailable, decisionOutcome } from '../domain/decision';
import type { V2DeskProps } from './InformationDesk';
import { MissingList, RequiredMark } from './RequiredMark';
import { useDraft } from './useDraft';
import '../app/screens/v2.css';

interface DecisionDraft {
  objectiveId: string;
  optionId: string;
  reason: string;
  assumptions: string;
  evidence: string[];
  counterEvidence: string[];
}
const emptyDraft = (): DecisionDraft => ({
  objectiveId: '',
  optionId: '',
  reason: '',
  assumptions: '',
  evidence: [],
  counterEvidence: [],
});

export function DecisionDesk({ caseData, progress, onAction }: V2DeskProps) {
  const definition = caseData.v2?.decision;
  const records = progress.v2?.decisions ?? [];
  // 記録前の入力は下書きとして残す（タブを切り替えても消えない）。判断ごとに別の下書き
  const [draft, setDraft, clearDraft] = useDraft<DecisionDraft>(
    `decision:${caseData.id}:${records.length}`,
    emptyDraft,
  );
  const { objectiveId, optionId, reason, assumptions, evidence, counterEvidence } = draft;
  const patch = (next: Partial<DecisionDraft>) => setDraft((prev) => ({ ...prev, ...next }));
  if (!definition) return null;
  const documents = caseData.documents.filter((document) => progress.opened.includes(document.id));
  const comparisonAvailable = decisionComparisonAvailable(caseData, progress);
  const waiting = records.length > 0 && !comparisonAvailable;
  const outcome = decisionOutcome(caseData, progress);
  const selectedEvidence = evidence.filter((id) =>
    documents.some((document) => document.id === id),
  );
  const selectedCounterEvidence = counterEvidence.filter((id) =>
    documents.some((document) => document.id === id),
  );
  // 足りない必須項目。空なら記録できる
  const missing = [
    !definition.objectives.some((objective) => objective.id === objectiveId) && '優先する目的',
    !definition.options.some(
      (option) => option.id === optionId && option.cost <= definition.resources,
    ) && '方針',
    !selectedEvidence.length && '方針を支える資料',
    !selectedCounterEvidence.length && '反対の見方・制約を示す資料',
    !assumptions.trim() && '前提・不確実な点',
    !reason.trim() && '選択理由',
  ].filter((item): item is string => Boolean(item));
  const valid = missing.length === 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(emptyDraft());
  const toggle = (ids: string[], id: string, checked: boolean) =>
    checked ? [...ids, id] : ids.filter((source) => source !== id);
  return (
    <section className="v2-desk" aria-label="意思決定シミュレーション">
      <h2 className="section-title">意思決定シミュレーション</h2>
      <p>{definition.prompt}</p>
      <p>
        行動に使える資源：{definition.resources}。これは、資料を開くための調査予算とは別の制限です。
      </p>
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
          判断を記録しました。新しく開けるようになった資料を確かめると、方針をそのままにするか変えるかを選べます。
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
            clearDraft();
          }}
        >
          {records.length > 0 && <p>{definition.updatePrompt}</p>}
          <fieldset disabled={progress.published}>
            <legend>{records.length ? '追加情報を踏まえた判断' : '現在の情報での判断'}</legend>
            <label htmlFor="decision-objective">
              優先する目的
              <RequiredMark />
            </label>
            <select
              id="decision-objective"
              value={objectiveId}
              onChange={(event) => patch({ objectiveId: event.target.value })}
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
              <legend>
                方針（どれを選んでも、合っている・まちがっているは付けません）
                <RequiredMark />
              </legend>
              {definition.options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="decision-option"
                    checked={optionId === option.id}
                    onChange={() => patch({ optionId: option.id })}
                    disabled={option.cost > definition.resources}
                  />
                  {option.text}（必要資源 {option.cost}
                  {option.cost > definition.resources ? '・資源不足' : ''}）
                </label>
              ))}
            </fieldset>
            <div className="v2-desk__columns">
              <fieldset>
                <legend>
                  方針を支える資料
                  <RequiredMark />
                </legend>
                {documents.map((document) => (
                  <label key={document.id}>
                    <input
                      type="checkbox"
                      checked={evidence.includes(document.id)}
                      disabled={counterEvidence.includes(document.id)}
                      onChange={(event) =>
                        patch({ evidence: toggle(evidence, document.id, event.target.checked) })
                      }
                    />
                    {document.title}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>
                  反対の見方・制約を示す資料
                  <RequiredMark />
                </legend>
                {documents.map((document) => (
                  <label key={document.id}>
                    <input
                      type="checkbox"
                      checked={counterEvidence.includes(document.id)}
                      disabled={evidence.includes(document.id)}
                      onChange={(event) =>
                        patch({
                          counterEvidence: toggle(
                            counterEvidence,
                            document.id,
                            event.target.checked,
                          ),
                        })
                      }
                    />
                    {document.title}
                  </label>
                ))}
              </fieldset>
            </div>
            {documents.length < 2 && <p>ちがう資料を 2 件以上読んでください。</p>}
            <label htmlFor="decision-assumptions">
              この判断が成り立つ前提・不確実な点
              <RequiredMark />
            </label>
            <textarea
              id="decision-assumptions"
              value={assumptions}
              onChange={(event) => patch({ assumptions: event.target.value })}
              maxLength={2000}
              required
            />
            <label htmlFor="decision-reason">
              目的と根拠を踏まえた選択理由
              <RequiredMark />
            </label>
            <textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => patch({ reason: event.target.value })}
              maxLength={2000}
              required
            />
            <MissingList items={missing} />
            {dirty && !valid && (
              <p className="fine">
                入力はまだ記録していません。この端末に下書きとして残しています。
              </p>
            )}
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
            結果がよかったか悪かったかで、判断が正しかったかどうかを決めることはしません。判断したときに分かっていた情報と前提をふり返ってください。
          </p>
          <details>
            <summary>ほかの方針を選んでいたらどうなっていたか（実際には起きていない想定）</summary>
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
