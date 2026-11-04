import { uiIcon } from '../data/assets';
import '../app/screens/stage-stepper.css';

/**
 * 調査 → 報告 → 結果 の 3 段階を図形で示すステッパー（Issue #177）。
 *
 * - 現在 = 塗りの丸、済 = チェック、先 = 白丸。段階名は丸の下に残し、色だけで区別しない。
 * - 現在の段階に `aria-current="step"` を付け、読み上げでは
 *   「3 段階中 1 番目、資料を調べる」のように何番目かが分かるようにする。
 * - `focusTarget` を付けると現在の段階が画面遷移時のフォーカス先（MVP-039 の `data-focus-target`）になる。
 *   告知文はフォーカス先の文字をそのまま読むので、見出しの文字列は隠しテキストも含めて 1 文に収める。
 */
const STAGES = [
  { id: 'investigate', label: '資料を調べる' },
  { id: 'report', label: '報告をまとめる' },
  { id: 'result', label: '結果' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];

export function StageStepper({
  current,
  focusTarget = false,
}: {
  current: StageId;
  focusTarget?: boolean;
}) {
  const currentIndex = STAGES.findIndex((s) => s.id === current);
  return (
    <ol className="stage-stepper" aria-label="調査の段階">
      {STAGES.map((stage, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'next';
        const isCurrent = state === 'current';
        return (
          <li
            key={stage.id}
            className={`stage-stepper__step is-${state}`}
            aria-current={isCurrent ? 'step' : undefined}
            {...(isCurrent && focusTarget ? { 'data-focus-target': true, tabIndex: -1 } : {})}
          >
            <span className="stage-stepper__mark" aria-hidden="true">
              {state === 'done' && <img src={uiIcon('check')} alt="" width={12} height={12} />}
            </span>
            <span className="visually-hidden">
              {STAGES.length} 段階中 {i + 1} 番目、
            </span>
            <span className="stage-stepper__label">{stage.label}</span>
            {state === 'done' && <span className="visually-hidden">（済み）</span>}
          </li>
        );
      })}
    </ol>
  );
}
