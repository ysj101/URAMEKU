import { useState } from 'react';
import type { V2BoardDisposition, V2BoardRecord, V2BoardTask } from '../domain/types';
import { BOARD_DISPOSITIONS, boardReviews, boardStatement } from '../domain/board';
import type { V2DeskProps } from './InformationDesk';
import { LegacyV2EvidenceBoard } from './LegacyV2EvidenceBoard';

type BoardProps = V2DeskProps & {
  activeTaskId?: string;
  onSelectTask?: (id: string) => void;
};

export function V2EvidenceBoard(props: BoardProps) {
  if (!props.caseData.v2?.board) return <LegacyV2EvidenceBoard {...props} />;
  return <ClaimBoard {...props} />;
}

function ClaimBoard({ caseData, progress, onAction, activeTaskId, onSelectTask }: BoardProps) {
  const board = caseData.v2!.board!;
  const [localActive, setLocalActive] = useState(board.tasks[0]!.id);
  const active = activeTaskId ?? localActive;
  const setActive = onSelectTask ?? setLocalActive;
  const reviews = boardReviews(caseData, progress);
  const task = board.tasks.find((entry) => entry.id === active) ?? board.tasks[0]!;
  const recorded = reviews.filter((review) => review.recorded).length;
  return (
    <section className="v2-desk evidence-board claim-board" role="group" aria-label="証拠ボード">
      <h2 className="section-title">
        証拠ボード <small>{board.title}</small>
      </h2>
      <p data-testid="link-prompt">{board.prompt}</p>
      <ol className="evidence-board__steps" aria-label="証拠ボードの使い方">
        <li>確かめたい文を選び、気になる部分を押す</li>
        <li>読んだ資料から、根拠になる一節を添える</li>
        <li>文を直すか、そのまま残すか、まだ判断できないかを記録する</li>
      </ol>
      <p>合っているかどうかは、報告を提出したあとに確かめます。</p>
      <div className="claim-board__tasks" aria-label="確かめる文">
        {board.tasks.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-pressed={entry.id === task.id}
            className="claim-board__task"
            onClick={() => setActive(entry.id)}
          >
            <strong>{entry.title}</strong>
            <span>{boardStatement(entry, progress.v2?.board?.[entry.id]?.values)}</span>
            <small>
              {reviews.find((review) => review.task.id === entry.id)?.recorded
                ? '記録あり'
                : '未記録'}
            </small>
          </button>
        ))}
      </div>
      {board.tasks.map((entry) => (
        <div key={entry.id} hidden={entry.id !== task.id}>
          <BoardEditor task={entry} caseData={caseData} progress={progress} onAction={onAction} />
        </div>
      ))}
      <p role="status">
        文と証拠を記録済み {recorded} / {board.tasks.length} 件
      </p>
    </section>
  );
}

function BoardEditor({ task, caseData, progress, onAction }: V2DeskProps & { task: V2BoardTask }) {
  const board = caseData.v2!.board!;
  const saved = progress.v2?.board?.[task.id];
  const [values, setValues] = useState<Record<string, string>>(
    () =>
      saved?.values ?? Object.fromEntries(task.fields.map((field) => [field.id, field.original])),
  );
  const [evidence, setEvidence] = useState<string[]>(saved?.evidence ?? []);
  const [disposition, setDisposition] = useState<V2BoardDisposition | ''>(saved?.disposition ?? '');
  const [fieldId, setFieldId] = useState<string | null>(null);
  const field = task.fields.find((entry) => entry.id === fieldId);
  const record = { values, evidence, disposition };
  const unchanged = Boolean(saved && JSON.stringify(saved) === JSON.stringify(record));
  const dirty = saved
    ? !unchanged
    : evidence.length > 0 ||
      Boolean(disposition) ||
      task.fields.some((entry) => values[entry.id] !== entry.original);
  const sources = caseData.documents.filter((entry) => progress.opened.includes(entry.id));
  return (
    <form
      className="claim-board__editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (evidence.length && disposition)
          onAction({ type: 'v2-board', taskId: task.id, record: record as V2BoardRecord });
      }}
    >
      <fieldset disabled={progress.published}>
        <legend>{task.title}</legend>
        <p>{task.prompt}</p>
        <p className="claim-board__sentence" aria-label="組み立てている文">
          {task.parts.map((part, index) => {
            if ('text' in part) return <span key={index}>{part.text}</span>;
            const entry = task.fields.find((candidate) => candidate.id === part.field)!;
            return (
              <button
                type="button"
                key={index}
                aria-label={`文の部分：${entry.label}`}
                aria-expanded={fieldId === entry.id}
                aria-controls={`board-field-${task.id}`}
                onClick={() => setFieldId(fieldId === entry.id ? null : entry.id)}
              >
                {entry.options.find((option) => option.id === values[entry.id])?.text}
              </button>
            );
          })}
        </p>
        <div id={`board-field-${task.id}`}>
          {field ? (
            <fieldset className="claim-board__pieces">
              <legend>文の部品：{field.label}</legend>
              {field.options.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  aria-pressed={values[field.id] === option.id}
                  onClick={() => setValues({ ...values, [field.id]: option.id })}
                >
                  {option.text}
                </button>
              ))}
            </fieldset>
          ) : (
            <p>文の下線が付いた部分を押すと、内容を組み直せます。</p>
          )}
        </div>
        <fieldset className="claim-board__sources">
          <legend>この文に添える証拠</legend>
          <p>
            資料を開いて読むと、一節をここから選べます。選んだ一節はこの文の根拠として残ります。
          </p>
          {sources.length === 0 && <p>まず、調査資料を開いて読みましょう。</p>}
          {sources.map((source) => (
            <details key={source.id}>
              <summary>{source.title}</summary>
              {board.excerpts
                .filter((entry) => entry.documentId === source.id)
                .map((entry) => (
                  <label key={entry.id} className="claim-board__excerpt">
                    <input
                      type="checkbox"
                      checked={evidence.includes(entry.id)}
                      onChange={(event) =>
                        setEvidence(
                          event.target.checked
                            ? [...evidence, entry.id]
                            : evidence.filter((id) => id !== entry.id),
                        )
                      }
                    />
                    <q>{entry.quote}</q>
                  </label>
                ))}
            </details>
          ))}
        </fieldset>
        {evidence.length > 0 && (
          <section aria-label="この文に添えた証拠" className="claim-board__attached">
            <h3>この文に添えた証拠</h3>
            <ul>
              {evidence.map((id) => {
                const entry = board.excerpts.find((candidate) => candidate.id === id)!;
                return (
                  <li key={id}>
                    <strong>
                      {caseData.documents.find((source) => source.id === entry.documentId)?.title}
                    </strong>
                    <q>{entry.quote}</q>
                    <button
                      type="button"
                      onClick={() => setEvidence(evidence.filter((candidate) => candidate !== id))}
                      aria-label={`${entry.quote}を証拠から外す`}
                    >
                      外す
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <fieldset className="claim-board__disposition">
          <legend>この文をどう扱うか</legend>
          {Object.entries(BOARD_DISPOSITIONS).map(([id, label]) => (
            <label key={id}>
              <input
                type="radio"
                name={`board-disposition-${task.id}`}
                checked={disposition === id}
                onChange={() => setDisposition(id as V2BoardDisposition)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          className="btn primary"
          disabled={!evidence.length || !disposition || unchanged}
        >
          {unchanged ? 'この文と証拠は記録済み' : '文と証拠を記録'}
        </button>
        {dirty && (
          <p role="status">変更はまだ記録していません。「文と証拠を記録」を押してください。</p>
        )}
      </fieldset>
    </form>
  );
}
