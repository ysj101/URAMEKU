import { useId, useState } from 'react';
import { interpretInput, type InputIssue } from '../domain/calculation';
import type { AnalysisTask } from '../domain/types';

/**
 * 検証メモ 1 問ぶんの数値入力欄（MVP-024）。
 *
 * `type="text"` + `inputMode="decimal"` を採用する理由:
 * - iOS / Android で小数点付きの数値キーボードが出る（`inputMode="decimal"`）。
 * - `type="number"` はブラウザが「１，２００」「45%」「150万円」のような全角・カンマ・単位付きの
 *   入力を黙って空文字にしてしまい、`interpretInput` に渡す前に情報が失われる。
 *   本作は「資料から自分で計算した数字」を書く欄なので、書き方のゆらぎは domain 側で解釈し、
 *   元の入力はそのまま保存する。
 * - `type="number"` はスクロールで値が変わる・`e` が入力できるなどの事故も多い。
 *
 * 正誤は一切表示しない（提出前に答えを知らせないため）。表示するのは
 * 「数値として読めたか」「負の値になっていないか」「正規化するとどう読めるか」だけ。
 */

const ISSUE_TEXT: Record<InputIssue, string | null> = {
  empty: null,
  'not-a-number': '数値として読めません',
  negative: '負の値になっています。計算を見直してください',
};

/** 入力の状態に応じた補助文。`empty` は補助なし */
export function issueMessage(issue: InputIssue | undefined): string | null {
  return issue ? ISSUE_TEXT[issue] : null;
}

interface Props {
  /** 問いの本文。ラベルとして表示する */
  label: string;
  /** 解釈に使うタスク（単位の除去に `unit` を使う） */
  task: Pick<AnalysisTask, 'unit'>;
  /** 保存されている生の入力 */
  value: string;
  /** 生の入力をそのまま返す（正規化しない） */
  onChange: (raw: string) => void;
  /** 提出済みのときは読み取り専用 */
  readOnly?: boolean;
  /** 複数の入力欄を順に入力するときのフォーカス移動用 */
  name?: string;
}

export function NumericField({ label, task, value, onChange, readOnly = false, name }: Props) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const normalizedId = `${inputId}-normalized`;
  const [blurred, setBlurred] = useState(false);

  const interpreted = interpretInput(value, task);
  const message = issueMessage(interpreted.issue);
  const invalid = interpreted.issue === 'not-a-number';
  // 正規化表示は blur 後、かつ数値として読めたときだけ。元の入力と同じならノイズになるので出さない
  const showNormalized =
    blurred && interpreted.value !== null && interpreted.normalized !== value.trim();
  const describedBy =
    [message ? hintId : null, showNormalized ? normalizedId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={`numeric-field${invalid ? ' is-invalid' : ''}`}>
      <label htmlFor={inputId} className="numeric-field__label">
        {label}
      </label>
      <div className="numeric-field__row">
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          className="numeric-field__input"
          placeholder="数値を入力"
          value={value}
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setBlurred(true)}
        />
        <span className="numeric-field__unit" aria-hidden="true">
          {task.unit}
        </span>
        <span className="visually-hidden">（単位: {task.unit}）</span>
      </div>
      {message && (
        <p id={hintId} className="numeric-field__hint">
          {message}
        </p>
      )}
      {showNormalized && (
        <p id={normalizedId} className="numeric-field__normalized">
          読み取り: <output htmlFor={inputId}>{interpreted.normalized}</output> {task.unit}
        </p>
      )}
    </div>
  );
}
