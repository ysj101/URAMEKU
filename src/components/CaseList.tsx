import type { CaseData } from '../domain/types';

interface Props {
  cases: CaseData[];
  activeId: string;
  finished: Record<string, boolean>;
  onSelect: (id: string) => void;
}

export function CaseList({ cases, activeId, finished, onSelect }: Props) {
  return (
    <ul className="case-list">
      {cases.map((c, i) => (
        <li key={c.id}>
          <button
            type="button"
            className={`case-option ${c.id === activeId ? 'active' : ''}`}
            aria-current={c.id === activeId ? 'true' : undefined}
            onClick={() => onSelect(c.id)}
          >
            <span className="num">
              CASE {String(i + 1).padStart(2, '0')}
              {finished[c.id] ? ' · CLEARED' : ''}
            </span>
            <span className="case-name">{c.title}</span>
            <span className="meta">
              {c.difficulty} / {c.estimated_time}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
