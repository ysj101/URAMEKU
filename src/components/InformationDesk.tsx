import type { GameAction } from '../domain/game';
import type { CaseData, CaseProgress } from '../domain/types';
import '../app/screens/v2.css';

export interface V2DeskProps {
  caseData: CaseData;
  progress: CaseProgress;
  onAction: (action: GameAction) => void;
}

/** Only the question and player's record are shown here; answer explanations stay in the debrief. */
export function InformationDesk({ caseData, progress, onAction }: V2DeskProps) {
  if (!caseData.v2?.decoding.length) return null;
  const documents = caseData.documents.filter(
    (document) => progress.opened.includes(document.id) && progress.pinned.includes(document.id),
  );
  return (
    <section className="v2-desk" aria-label="情報解読メモ">
      <h2 className="section-title">情報解読メモ</h2>
      <p>資料の出典・対象・期間を比べ、言えることと言い切れないことを記録してください。</p>
      {caseData.v2.decoding.map((task) => {
        const record = progress.v2?.decoding[task.id];
        const update = (optionId: string, evidence: string[], note?: string) =>
          onAction({ type: 'v2-decode', taskId: task.id, optionId, evidence, note });
        return (
          <fieldset key={task.id} disabled={progress.published}>
            <legend>{task.prompt}</legend>
            <div className="v2-desk__choices">
              {task.options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name={`decode-${task.id}`}
                    checked={record?.optionId === option.id}
                    onChange={() => update(option.id, record?.evidence ?? [], record?.note)}
                  />
                  {option.text}
                </label>
              ))}
            </div>
            <fieldset>
              <legend>この読み取りを支える資料</legend>
              {documents.length === 0 && <p>資料を読み、証拠ボードに採用すると選べます。</p>}
              {documents.map((document) => (
                <label key={document.id}>
                  <input
                    type="checkbox"
                    checked={record?.evidence.includes(document.id) ?? false}
                    disabled={!record?.optionId}
                    onChange={(event) => {
                      if (!record) return;
                      const evidence = event.target.checked
                        ? [...record.evidence, document.id]
                        : record.evidence.filter((id) => id !== document.id);
                      update(record.optionId, evidence, record.note);
                    }}
                  />
                  {document.title}
                </label>
              ))}
            </fieldset>
            <label htmlFor={`decode-note-${task.id}`}>補足メモ（任意）</label>
            <textarea
              id={`decode-note-${task.id}`}
              value={record?.note ?? ''}
              maxLength={2000}
              disabled={!record?.optionId}
              onChange={(event) => {
                if (record) update(record.optionId, record.evidence, event.target.value);
              }}
            />
          </fieldset>
        );
      })}
      {progress.published && (
        <p role="status">提出済みです。記録を修正するには取り下げてください。</p>
      )}
    </section>
  );
}
