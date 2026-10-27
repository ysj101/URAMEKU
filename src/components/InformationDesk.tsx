import { useState } from 'react';
import type { GameAction } from '../domain/game';
import type { CaseData, CaseProgress, V2DecodingTask } from '../domain/types';
import '../app/screens/v2.css';

export interface V2DeskProps {
  caseData: CaseData;
  progress: CaseProgress;
  onAction: (action: GameAction) => void;
}

function firstUnanswered(tasks: V2DecodingTask[], progress: CaseProgress): string | null {
  return (
    tasks.find((task) => !progress.v2?.decoding[task.id]?.optionId)?.id ?? tasks[0]?.id ?? null
  );
}

/**
 * 情報解読メモ。問いはアコーディオンで、開くのは常に 1 問。
 * 回答済みの問いは 1 行（✓ と選んだ答え）に畳む。
 * Only the question and player's record are shown here; answer explanations stay in the debrief.
 */
export function InformationDesk({ caseData, progress, onAction }: V2DeskProps) {
  const tasks = caseData.v2?.decoding ?? [];
  const [openId, setOpenId] = useState<string | null>(() => firstUnanswered(tasks, progress));
  if (!tasks.length) return null;
  const documents = caseData.documents.filter(
    (document) => progress.opened.includes(document.id) && progress.pinned.includes(document.id),
  );
  return (
    <section className="v2-desk" aria-label="情報解読メモ">
      <h2 className="section-title">情報解読メモ</h2>
      <p className="v2-desk__lead">
        資料の出典・対象・期間を比べ、言えることと言い切れないことを記録してください。回答済みの問いは畳まれます。
      </p>
      {tasks.map((task, index) => {
        const record = progress.v2?.decoding[task.id];
        const answered = Boolean(record?.optionId);
        const open = openId === task.id;
        const chosen = task.options.find((option) => option.id === record?.optionId);
        const next = tasks[index + 1];
        const promptId = `decode-prompt-${task.id}`;
        const bodyId = `decode-body-${task.id}`;
        const update = (optionId: string, evidence: string[], note?: string) =>
          onAction({ type: 'v2-decode', taskId: task.id, optionId, evidence, note });
        return (
          <fieldset
            key={task.id}
            className={`v2-task ${answered ? 'v2-task--answered' : ''} ${open ? 'v2-task--open' : ''}`}
            disabled={progress.published}
            aria-labelledby={promptId}
          >
            <button
              type="button"
              className="v2-task__head"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpenId(open ? null : task.id)}
            >
              <span className="v2-task__mark" aria-hidden="true">
                {answered ? '✓' : index + 1}
              </span>
              <span className="v2-task__text">
                <span className="v2-task__meta">
                  問 {index + 1} ・ {answered ? '回答済み' : '未回答'}
                  {answered && ` ・ 根拠 ${record?.evidence.length ?? 0} 件`}
                </span>
                <span className="v2-task__prompt" id={promptId}>
                  {task.prompt}
                </span>
                {!open && chosen && <span className="v2-task__answer">→ {chosen.text}</span>}
              </span>
              <span className="v2-task__action">
                {open ? '閉じる' : answered ? '変更する' : '回答する'}
              </span>
            </button>
            {open && (
              <div className="v2-task__body" id={bodyId}>
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
                <fieldset className="v2-task__evidence">
                  <legend>この読み取りを支える資料</legend>
                  {documents.length === 0 && <p>資料を読み、証拠ボードに採用すると選べます。</p>}
                  <div className="v2-task__chips">
                    {documents.map((document) => (
                      <label key={document.id} className="v2-task__chip">
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
                  </div>
                </fieldset>
                <details className="v2-task__note" open={Boolean(record?.note)}>
                  <summary>補足メモ（任意）</summary>
                  <label htmlFor={`decode-note-${task.id}`} className="visually-hidden">
                    補足メモ（任意）
                  </label>
                  <textarea
                    id={`decode-note-${task.id}`}
                    value={record?.note ?? ''}
                    maxLength={2000}
                    disabled={!record?.optionId}
                    onChange={(event) => {
                      if (record) update(record.optionId, record.evidence, event.target.value);
                    }}
                  />
                </details>
                {next && (
                  <button
                    type="button"
                    className="btn ghost v2-task__next"
                    onClick={() => setOpenId(next.id)}
                  >
                    次の問いへ →
                  </button>
                )}
              </div>
            )}
          </fieldset>
        );
      })}
      {progress.published && (
        <p role="status">提出済みです。記録を修正するには取り下げてください。</p>
      )}
    </section>
  );
}
