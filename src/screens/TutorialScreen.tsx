import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../data/assets';
import case00 from '../../data/tutorial/case-00.json';
import { useTutorialState } from '../state/tutorialState';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';
import type { StorageLike } from '../state/persistence';
import '../app/screens/tutorial.css';
import '../app/screens/case00.css';

export const FIRST_CASE_ID = 'case-01';

export interface TutorialScreenProps {
  nav: Navigation;
  game?: Pick<GameApi, 'selectCase'>;
  storage?: StorageLike | null;
}

/** CASE00 is a guided practice file, kept separate from the five investigation cases. */
export function TutorialScreen({ nav, game, storage }: TutorialScreenProps) {
  const [step, setStep] = useState(-2);
  const [initialChoice, setInitialChoice] = useState('');
  const [updatedChoice, setUpdatedChoice] = useState('');
  const [opened, setOpened] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answerId, setAnswerId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const { markCompleted } = useTutorialState(storage);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [step]);
  const answer = case00.options.find((option) => option.id === answerId);
  const evidence = case00.excerpts.find((excerpt) => excerpt.id === evidenceId);
  const documentTitle = (id: string) => case00.documents.find((doc) => doc.id === id)?.title;
  const nextDocument = case00.documents.find((doc) => !opened.includes(doc.id));
  const allRead = !nextDocument;
  const openDocument = case00.documents.find((doc) => doc.id === openId);

  const initialItem = case00.experiment.items.find((item) => item.id === initialChoice);
  const updatedItem = case00.experiment.items.find((item) => item.id === updatedChoice);
  const choiceSummary =
    initialItem && updatedItem ? (
      <aside className="case00-choice-summary" aria-label="ドリンク選びの記録">
        <span>最初：{initialItem.label}サイズ</span>
        <span aria-hidden="true"> → </span>
        <span>M追加後：{updatedItem.label}サイズ</span>
      </aside>
    ) : null;

  return (
    <section className="tutorial case00" aria-labelledby="tutorial-title">
      <div className="screen-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'home' })}
        >
          ← ホーム
        </button>
        <h1 id="tutorial-title">遊び方</h1>
      </div>
      <header className="case00-intro">
        <p className="edition">CASE 00 / はじめての調査 / 約3分</p>
        <h2>{step === -2 ? case00.openingTitle : case00.title}</h2>
        {step < 0 && <p>{case00.lead}</p>}
      </header>
      <p className="case00-step-count" aria-label="練習の進み具合">
        STEP {step + 3} / {case00.steps.length}
      </p>
      <section className="case00-paper" aria-labelledby="practice-step-title">
        <h2 id="practice-step-title" ref={heading} tabIndex={-1}>
          {step + 3}. {case00.steps[step + 2]}
        </h2>
        {step < 0 && (
          <>
            <p className="case00-menu-prompt">
              {step === -2 ? case00.experiment.initialPrompt : case00.experiment.updatedPrompt}
            </p>
            {step === -1 && initialItem && <p>最初に選んだのは{initialItem.label}サイズでした。</p>}
            <fieldset className="case00-menu">
              <legend>{step === -2 ? '最初のメニュー' : 'Mが加わったメニュー'}</legend>
              {case00.experiment.items
                .filter((item) =>
                  (step === -2 ? case00.experiment.initial : case00.experiment.updated).includes(
                    item.id,
                  ),
                )
                .map((item) => (
                  <label className="case00-drink" key={item.id}>
                    <input
                      type="radio"
                      name="practice-drink"
                      checked={(step === -2 ? initialChoice : updatedChoice) === item.id}
                      onChange={() =>
                        step === -2 ? setInitialChoice(item.id) : setUpdatedChoice(item.id)
                      }
                    />
                    <span className="case00-cup" data-size={item.id} aria-hidden="true">
                      <span>{item.label}</span>
                    </span>
                    <strong>{item.label}サイズ</strong>
                    <span className="case00-drink-price">{item.price}円</span>
                    <span>{item.volume}mL</span>
                  </label>
                ))}
            </fieldset>
            <p className="fine">{case00.experiment.notice}</p>
            <button
              type="button"
              className="btn primary"
              disabled={!(step === -2 ? initialChoice : updatedChoice)}
              onClick={() => setStep(step + 1)}
            >
              {step === -2 ? 'これにする →' : '資料を開く →'}
            </button>
          </>
        )}
        {step === 0 && (
          <>
            {choiceSummary}
            <p>{case00.investigationPrompt}</p>

            <div className="case00-documents">
              {case00.documents.map((doc, index) => (
                <button
                  key={doc.id}
                  type="button"
                  className={`case00-document${doc.id === nextDocument?.id ? ' btn primary' : ''}`}
                  aria-expanded={openId === doc.id}
                  aria-controls="practice-document"
                  onClick={() => {
                    setOpenId(doc.id);
                    setOpened((previous) =>
                      previous.includes(doc.id) ? previous : [...previous, doc.id],
                    );
                  }}
                >
                  <small>
                    資料 {index + 1} / {opened.includes(doc.id) ? '読んだ' : '未読'}
                  </small>
                  <strong>{doc.title}を開く</strong>
                </button>
              ))}
            </div>
            <div id="practice-document" aria-live="polite">
              {openDocument && (
                <article className="case00-source">
                  <h3>{openDocument.title}</h3>
                  <p className="fine">出典：{openDocument.source}</p>
                  <p>{openDocument.content}</p>
                </article>
              )}
            </div>
            <p role="status">
              資料確認 {opened.length} / {case00.documents.length}
              {allRead ? '枚。答えに進めます。' : '枚。2枚とも開こう。'}
            </p>
            {allRead && (
              <button type="button" className="btn primary" onClick={() => setStep(1)}>
                答えを選ぶ →
              </button>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <p>答えと、その根拠を1つずつ選ぼう。</p>
            <fieldset className="case00-choices">
              <legend>{case00.question}</legend>
              {case00.options.map((option) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="practice-answer"
                    checked={answerId === option.id}
                    onChange={() => setAnswerId(option.id)}
                  />
                  {option.text}
                </label>
              ))}
            </fieldset>
            <fieldset className="case00-choices">
              <legend>答えの根拠になる一節は？</legend>
              {case00.excerpts.map((excerpt) => (
                <label key={excerpt.id}>
                  <input
                    type="radio"
                    name="practice-evidence"
                    checked={evidenceId === excerpt.id}
                    onChange={() => setEvidenceId(excerpt.id)}
                  />
                  <span>
                    {documentTitle(excerpt.documentId)}
                    <q>{excerpt.quote}</q>
                  </span>
                </label>
              ))}
            </fieldset>
            <p role="status">
              {answer && evidence
                ? '答えと根拠を選びました。'
                : '答えと根拠を選ぶと、先に進めます。'}
            </p>
            <div className="tutorial-controls">
              <button type="button" className="btn ghost" onClick={() => setStep(0)}>
                ← 資料を読み直す
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!answer || !evidence}
                onClick={() => setStep(2)}
              >
                報告をまとめる →
              </button>
            </div>
          </>
        )}
        {step === 2 && answer && evidence && (
          <>
            {choiceSummary}

            <dl className="case00-report">
              <dt>あなたの答え</dt>
              <dd>{answer.text}</dd>
              <dt>添えた根拠</dt>
              <dd>
                {documentTitle(evidence.documentId)}
                <q>{evidence.quote}</q>
              </dd>
            </dl>

            <div className="tutorial-controls">
              <button type="button" className="btn ghost" onClick={() => setStep(1)}>
                ← 答えを見直す
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  markCompleted();
                  setStep(3);
                }}
              >
                報告する →
              </button>
            </div>
          </>
        )}
        {step === 3 && answer && evidence && (
          <>
            <p className="case00-complete">CASE 00 調査完了</p>
            <p>
              {answer.accepted && evidence.supportsAnswer
                ? '答えと根拠を、資料で確かめられました。'
                : '最後まで調査できました。答えと根拠を見直してみましょう。'}
            </p>
            <section className="case00-learning" aria-label="おとり効果を学ぶ">
              <h3>増えたのは、比べる相手。</h3>
              <a
                className="case00-explanation-image"
                href={assetUrl(case00.visualGuide.image)}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={assetUrl(case00.visualGuide.image)}
                  alt={case00.visualGuide.imageAlt}
                  width="1536"
                  height="1024"
                />
                <span>図を大きく見る（別タブ）</span>
              </a>
              {choiceSummary}
              <p>
                {initialChoice === updatedChoice
                  ? case00.experiment.unchanged
                  : case00.experiment.changed}
              </p>
              <p>{case00.visualGuide.intro}</p>
              <p className="fine">{case00.experiment.limit}</p>
              <details>
                <summary>答え・根拠・詳しい解説</summary>
                <dl className="case00-report">
                  <dt>あなたの答え</dt>
                  <dd>
                    {answer.text}（
                    {answer.accepted ? '資料と合っています' : case00.feedback.answerReview}）
                  </dd>
                  <dt>あなたの根拠</dt>
                  <dd>
                    {documentTitle(evidence.documentId)}（
                    {evidence.supportsAnswer
                      ? case00.feedback.evidenceSupported
                      : case00.feedback.evidenceUnsupported}
                    ）
                  </dd>
                </dl>
                <p>{case00.explanation}</p>
                <p>{case00.experiment.explanation}</p>
                <p>{case00.limit}</p>
                <p>{case00.takeaway}</p>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setInitialChoice('');
                    setUpdatedChoice('');
                    setOpened([]);
                    setOpenId(null);
                    setAnswerId('');
                    setEvidenceId('');
                    setStep(-2);
                  }}
                >
                  最初のメニューからやり直す
                </button>
              </details>
            </section>
            <section className="case00-source" aria-label={case00.column.title}>
              <h3>{case00.column.title}</h3>
              {case00.column.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <ul>
                {case00.column.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
            <div className="tutorial-controls">
              <button type="button" className="btn ghost" onClick={() => setStep(1)}>
                もう一度答える
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  game?.selectCase(FIRST_CASE_ID);
                  nav.navigate({ screen: 'play', caseId: FIRST_CASE_ID });
                }}
              >
                本編へ進む →
              </button>
            </div>
          </>
        )}
      </section>
      <button type="button" className="btn ghost" onClick={() => nav.navigate({ screen: 'cases' })}>
        {step === 3 ? '事件一覧へ' : '練習をやめて事件一覧へ'}
      </button>
      <p className="fine">架空の映画館です。途中の記録は画面を離れると消えます。</p>
    </section>
  );
}
