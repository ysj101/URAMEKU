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
 * 根拠は手動で選ばせない。選んだ答えが参照する資料を一覧し、
 * すべて開いて証拠ボードに採用していれば ✓、未採用があれば「!」で促す。
 * Only the question and player's record are shown here; answer explanations stay in the debrief.
 */
export function InformationDesk({ caseData, progress, onAction }: V2DeskProps) {
  const tasks = caseData.v2?.decoding ?? [];
  const [openId, setOpenId] = useState<string | null>(() => firstUnanswered(tasks, progress));
  if (!tasks.length) return null;
  const title = (id: string) => caseData.documents.find((d) => d.id === id)?.title ?? id;
  const adopted = (id: string) => progress.opened.includes(id) && progress.pinned.includes(id);
  return (
    <section className="v2-desk" aria-label="情報解読メモ">
      <h2 className="section-title">情報解読メモ</h2>
      <p className="v2-desk__lead">
        答えを選ぶと、その読み取りが参照する資料が並びます。参照する資料をすべて開いて証拠ボードに採用すると、根拠ありとして記録が完了します。
      </p>
      {tasks.map((task, index) => {
        const record = progress.v2?.decoding[task.id];
        const chosen = task.options.find((option) => option.id === record?.optionId);
        const answered = Boolean(chosen);
        const references = chosen?.evidence ?? [];
        const missing = references.filter((id) => !adopted(id));
        const grounded = answered && references.length > 0 && missing.length === 0;
        const needsEvidence = answered && !grounded;
        const open = openId === task.id;
        const next = tasks[index + 1];
        const promptId = `decode-prompt-${task.id}`;
        const bodyId = `decode-body-${task.id}`;
        const update = (optionId: string, note?: string) => {
          const option = task.options.find((candidate) => candidate.id === optionId);
          onAction({
            type: 'v2-decode',
            taskId: task.id,
            optionId,
            evidence: option?.evidence ?? [],
            note,
          });
        };
        const stateClass = grounded
          ? 'v2-task--answered'
          : needsEvidence
            ? 'v2-task--needs-evidence'
            : '';
        return (
          <fieldset
            key={task.id}
            className={`v2-task ${stateClass} ${open ? 'v2-task--open' : ''}`}
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
                {grounded ? '✓' : needsEvidence ? '!' : index + 1}
              </span>
              <span className="v2-task__text">
                <span className="v2-task__meta">
                  問 {index + 1} ・ {answered ? '回答済み' : '未回答'}
                  {grounded && ` ・ 根拠 ${references.length} 件`}
                  {needsEvidence && ` ・ 参照資料が未採用 ${missing.length} 件`}
                </span>
                <span className="v2-task__prompt" id={promptId}>
                  {task.prompt}
                </span>
                {!open && chosen && <span className="v2-task__answer">→ {chosen.text}</span>}
              </span>
              <span className="v2-task__action">
                {open
                  ? '閉じる'
                  : needsEvidence
                    ? '資料を確認'
                    : answered
                      ? '変更する'
                      : '回答する'}
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
                        onChange={() => update(option.id, record?.note)}
                      />
                      {option.text}
                    </label>
                  ))}
                </div>
                <section
                  className={`v2-task__evidence ${needsEvidence ? 'v2-task__evidence--needed' : ''}`}
                  aria-label="この読み取りが参照する資料"
                >
                  <h3 className="v2-task__evidence-title">この読み取りが参照する資料</h3>
                  {!answered && <p>答えを選ぶと、参照する資料と採用状況がここに並びます。</p>}
                  {answered && (
                    <ul className="v2-task__refs">
                      {references.map((id) => (
                        <li
                          key={id}
                          className={adopted(id) ? 'v2-task__ref is-adopted' : 'v2-task__ref'}
                        >
                          <span aria-hidden="true">{adopted(id) ? '✓' : '○'}</span>
                          {title(id)}
                          <small>{adopted(id) ? '採用済み' : '未採用'}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                  {needsEvidence && (
                    <p className="v2-task__warning" role="status">
                      未採用の資料があります。左の調査資料から開き、「証拠ボードに貼る」で採用すると根拠ありになります。
                    </p>
                  )}
                  {grounded && (
                    <p className="v2-task__ok" role="status">
                      参照する資料はすべて採用済みです。根拠ありとして記録しました。
                    </p>
                  )}
                </section>
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
                      if (record) update(record.optionId, event.target.value);
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
