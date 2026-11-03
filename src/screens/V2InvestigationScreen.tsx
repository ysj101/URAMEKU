import { useEffect, useState } from 'react';
import { ConfirmPanel } from '../components/ConfirmPanel';
import { DocumentDialog } from '../components/DocumentDialog';
import { DocumentGrid } from '../components/DocumentGrid';
import { InformationDesk } from '../components/InformationDesk';
import { ExperimentDesk } from '../components/ExperimentDesk';
import { DecisionDesk } from '../components/DecisionDesk';
import { V2EvidenceBoard } from '../components/V2EvidenceBoard';
import { canOpenDocument, remainingBudget, isDocumentSealed } from '../domain/budget';
import { isDeadEnd } from '../domain/deadEnd';
import { decisionComplete } from '../domain/decision';
import { decodingReviews } from '../domain/decoding';
import { boardReviews } from '../domain/board';
import { experimentComplete } from '../domain/experiment';
import type { CaseData, CaseProgress } from '../domain/types';
import type { GameApi } from '../state/useGame';
import { UI } from '../data/ui';
import '../app/screens/desk.css';
import '../app/screens/v2-integration.css';
import '../app/screens/v2-desk.css';

/** 右側デスクのタブ。事件が持つ方式（modes）に応じて増減する */
type DeskTab = 'experiment' | 'decoding' | 'board' | 'decision';

const TAB_LABEL: Record<DeskTab, string> = {
  experiment: '見え方のミニ実験',
  decoding: '情報解読メモ',
  board: '証拠ボード',
  decision: '意思決定',
};

const TAB_STORAGE_PREFIX = 'urameku:desk-tab:';

function readStoredTab(caseId: string, tabs: DeskTab[]): DeskTab | null {
  try {
    const raw = window.sessionStorage.getItem(TAB_STORAGE_PREFIX + caseId);
    return tabs.find((tab) => tab === raw) ?? null;
  } catch {
    return null;
  }
}

function storeTab(caseId: string, tab: DeskTab) {
  try {
    window.sessionStorage.setItem(TAB_STORAGE_PREFIX + caseId, tab);
  } catch {
    /* プライベートモード等で保存できなくても画面は動く */
  }
}

function summarize(caseData: CaseData, progress: CaseProgress) {
  const v2 = caseData.v2;
  const tasks = v2?.decoding ?? [];
  const reviews = decodingReviews(caseData, progress);
  // 「回答済み」は答えを選び、参照資料をすべて読んだ問い。答えだけの問いは根拠待ちとして別に数える。
  const answered = reviews.filter((review) => review.recorded && review.grounded).length;
  const awaitingEvidence = reviews.filter((review) => review.recorded && !review.grounded).length;
  const links = v2?.board
    ? boardReviews(caseData, progress).filter((review) => review.recorded).length
    : (progress.v2?.links.length ?? 0);
  const paths = v2?.graph.paths ?? [];
  const linkTarget =
    v2?.board?.tasks.length ?? (paths.length ? Math.min(...paths.map((path) => path.length)) : 0);
  return {
    answered,
    awaitingEvidence,
    tasks: tasks.length,
    links,
    linkTarget,
    remainingTasks: Math.max(0, tasks.length - answered),
    remainingLinks: Math.max(0, linkTarget - links),
  };
}

/** V2の操作をJSONの方式から組み立てる。旧計算デスクは表示しない。 */
export function V2InvestigationScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const [activeTaskId, setActiveTaskId] = useState<string | null>(
    () =>
      decodingReviews(current, progress).find((review) => !review.recorded || !review.grounded)
        ?.taskId ??
      current.v2?.decoding[0]?.id ??
      null,
  );
  const [boardTaskId, setBoardTaskId] = useState<string | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [blockedDocument, setBlockedDocument] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetEpoch, setResetEpoch] = useState(0);
  const v2 = current.v2;
  const tabs: DeskTab[] = [
    ...(v2?.experiment ? (['experiment'] as const) : []),
    'decoding',
    'board',
    ...(v2?.decision ? (['decision'] as const) : []),
  ];
  const [tab, setTab] = useState<DeskTab>(() => readStoredTab(current.id, tabs) ?? 'decoding');
  useEffect(() => storeTab(current.id, tab), [current.id, tab]);
  if (!v2) return null;

  const props = { caseData: current, progress, onAction: dispatch };
  const initialExperiment = Boolean(v2.experiment && !progress.v2?.experiment?.initialChoice);
  const summary = summarize(current, progress);
  const budget = remainingBudget(current, progress);
  const tabDone: Partial<Record<DeskTab, boolean>> = {
    experiment: experimentComplete(current, progress),
    decoding: summary.tasks > 0 && summary.remainingTasks === 0,
    board: summary.linkTarget > 0 && summary.remainingLinks === 0,
    decision: decisionComplete(current, progress),
  };
  const tabBadge: Partial<Record<DeskTab, string>> = {
    decoding: `${summary.answered} / ${summary.tasks}`,
    board: `${summary.links} 件`,
    experiment: tabDone.experiment ? '記録済み' : '未完了',
    decision: tabDone.decision ? '記録済み' : '未完了',
  };
  const selectTab = (next: DeskTab) => {
    setTab(next);
    requestAnimationFrame(() => {
      document.getElementById('v2-desk-panel')?.scrollIntoView({ block: 'nearest' });
    });
  };
  const openDocument = (documentId: string) => {
    if (!canOpenDocument(current, progress, documentId)) {
      setBlockedDocument(documentId);
      return;
    }
    setBlockedDocument(null);
    dispatch({ type: 'open-document', documentId });
    setOpenId(documentId);
  };
  const showQuestion = (id: string) => {
    setActiveTaskId(id);
    selectTab('decoding');
  };
  const reviews = decodingReviews(current, progress);
  const firstDocument = current.documents[0];
  const pending = [
    summary.remainingTasks > 0
      ? `読み取り あと ${summary.remainingTasks} 問${
          summary.awaitingEvidence > 0
            ? `（まだ読んでいない資料がある ${summary.awaitingEvidence} 問）`
            : ''
        }`
      : null,
    summary.remainingLinks > 0
      ? `${v2.board ? '文と証拠' : '関係'} あと ${summary.remainingLinks} 件`
      : null,
  ].filter(Boolean);

  const nextReview = reviews.find((review) => !review.recorded || !review.grounded);
  const nextBoard = boardReviews(current, progress).find((review) => !review.recorded);
  const complete =
    pending.length === 0 &&
    (!v2.experiment || tabDone.experiment) &&
    (!v2.decision || tabDone.decision);
  const missingEvidence = nextReview?.evidence.find((id) => !progress.opened.includes(id));
  const nextDocumentId =
    complete || initialExperiment
      ? undefined
      : firstDocument && !progress.opened.includes(firstDocument.id)
        ? firstDocument.id
        : (missingEvidence ??
          (!nextReview && !nextBoard
            ? [
                ...(v2.experiment?.revealDocuments ?? []),
                ...(v2.decision?.revealDocuments ?? []),
              ].find((id) => !progress.opened.includes(id))
            : undefined));
  const nextDocument = current.documents.find((doc) => doc.id === nextDocumentId);
  // shown: 操作先がすでに画面のデスクに出ている。そのときはデスク側の操作を主役にする。
  let next = {
    text: '記録はそろいました。報告へ進めます。',
    label: '調査報告をまとめる →',
    run: () => game.setStage('article'),
    shown: false,
  };
  if (
    initialExperiment ||
    (nextDocumentId && isDocumentSealed(current, progress, nextDocumentId))
  ) {
    const target = initialExperiment ? 'experiment' : 'decision';
    next = {
      text: 'まず、今ある情報で最初の判断を記録しましょう。',
      label: initialExperiment ? 'ミニ実験を開く' : '意思決定を開く',
      run: () => selectTab(target),
      shown: initialExperiment || tab === target,
    };
  } else if (nextDocument) {
    next = canOpenDocument(current, progress, nextDocument.id)
      ? {
          text: '資料を開いて、答えのもとになる情報を読みましょう。',
          label: `${nextDocument.title}を開く`,
          run: () => openDocument(nextDocument.id),
          shown: false,
        }
      : {
          text: '調査予算が足りません。最初から調べ直せます。',
          label: 'この事件を最初からやり直す',
          run: () => setConfirmReset(true),
          shown: false,
        };
  } else if (nextReview) {
    next = {
      text: '答えを選んで記録し、下に出る資料をすべて読みましょう。',
      label: `問${reviews.indexOf(nextReview) + 1}を開く`,
      run: () => showQuestion(nextReview.taskId),
      shown: tab === 'decoding' && activeTaskId === nextReview.taskId,
    };
  } else if (!tabDone.board && summary.linkTarget > 0) {
    next = {
      text: '文に証拠を添え、文をどう扱うか選んで記録しましょう。',
      label: nextBoard ? `証拠ボード：${nextBoard.task.title}を開く` : '証拠ボードを開く',
      run: () => {
        setBoardTaskId(nextBoard?.task.id);
        selectTab('board');
      },
      shown:
        tab === 'board' &&
        (!nextBoard || (boardTaskId ?? v2.board?.tasks[0]?.id) === nextBoard.task.id),
    };
  } else if (v2.experiment && !tabDone.experiment) {
    next = {
      text: '資料を読んだあとの判断を、ミニ実験に記録しましょう。',
      label: 'ミニ実験を開く',
      run: () => selectTab('experiment'),
      shown: tab === 'experiment',
    };
  } else if (v2.decision && !tabDone.decision) {
    next = {
      text: '目的と資料をもとに、意思決定の判断を記録しましょう。',
      label: '意思決定を開く',
      run: () => selectTab('decision'),
      shown: tab === 'decision',
    };
  }

  return (
    <div className="v2-workspace v2-desk-screen">
      <div className="meter v2-meter">
        <span data-focus-target tabIndex={-1}>
          STEP 01 / 資料を調べる
        </span>
        <span className="v2-meter__budget">
          <span className="v2-meter__pips" aria-hidden="true">
            {Array.from({ length: current.budget }, (_, i) => (
              <span key={i} className={i < budget ? 'v2-meter__pip' : 'v2-meter__pip is-spent'} />
            ))}
          </span>
          <span className="budget">
            調査予算：残り {budget} / {current.budget}
          </span>
        </span>
      </div>

      <section className="v2-panel v2-next" aria-labelledby="v2-next-title">
        <h2 id="v2-next-title">次にやること</h2>
        <p>{next.text}</p>
        <button
          type="button"
          className={`btn ${next.shown ? 'ghost' : 'primary'}`}
          onClick={next.run}
        >
          {next.label}
        </button>
      </section>

      {blockedDocument && !canOpenDocument(current, progress, blockedDocument) && (
        <p className="notice" role="status">
          「{current.documents.find((doc) => doc.id === blockedDocument)?.title}」
          {isDocumentSealed(current, progress, blockedDocument)
            ? 'は、最初の判断を記録すると開けます。'
            : 'は調査予算が足りないため開けません。この事件を最初から調査し直せます。'}
        </p>
      )}
      {isDeadEnd(current, progress) && (
        <p className="notice" role="status">
          資料を開くための調査予算が残っていません。この事件を最初から調査し直せます。
          <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
            この事件を最初からやり直す
          </button>
        </p>
      )}

      {initialExperiment ? (
        <>
          <section className="v2-panel" id="v2-desk-panel">
            <ExperimentDesk key={resetEpoch} {...props} />
          </section>
          <p className="notice">
            まず、最初に見えている情報だけで判断を記録します。記録すると、調査資料を開けるようになります。保留を選んでもかまいません。
          </p>
        </>
      ) : (
        <div className="v2-desk-layout">
          <section className="v2-docs" aria-labelledby="v2-documents">
            <h2 className="section-title v2-docs__title" id="v2-documents">
              調査資料{' '}
              <small>
                {progress.opened.length} / {current.documents.length} 件確認済み
              </small>
            </h2>
            <DocumentGrid
              key={resetEpoch}
              caseData={current}
              progress={progress}
              onOpen={openDocument}
            />
          </section>

          <section className="v2-desk-panel" id="v2-desk-panel" aria-label="デスク">
            <div className="v2-tabs" role="tablist" aria-label="デスクの切り替え">
              {tabs.map((candidate) => (
                // TODO(#160): 図鑑のタブと同じく矢印キーで移動できるようにする
                // eslint-disable-next-line no-restricted-syntax
                <button
                  key={candidate}
                  type="button"
                  role="tab"
                  id={`v2-tab-${candidate}`}
                  className={`v2-tab ${tabDone[candidate] ? 'is-done' : ''}`}
                  aria-selected={tab === candidate}
                  aria-controls="v2-tabpanel"
                  onClick={() => selectTab(candidate)}
                >
                  {TAB_LABEL[candidate]}
                  {tabBadge[candidate] && (
                    <span className="v2-tab__badge">{tabBadge[candidate]}</span>
                  )}
                </button>
              ))}
            </div>
            <div
              className="v2-tabpanel"
              id="v2-tabpanel"
              role="tabpanel"
              aria-labelledby={`v2-tab-${tab}`}
            >
              {tab === 'experiment' && v2.experiment && (
                <ExperimentDesk key={resetEpoch} {...props} />
              )}
              {tab === 'decoding' && (
                <InformationDesk
                  key={resetEpoch}
                  {...props}
                  activeTaskId={activeTaskId}
                  onSelectTask={setActiveTaskId}
                  onOpenDocument={openDocument}
                />
              )}
              {tab === 'board' && (
                <V2EvidenceBoard
                  key={resetEpoch}
                  {...props}
                  activeTaskId={boardTaskId}
                  onSelectTask={setBoardTaskId}
                />
              )}
              {tab === 'decision' && v2.decision && <DecisionDesk key={resetEpoch} {...props} />}
            </div>
          </section>
        </div>
      )}

      {!initialExperiment && (
        <details className="v2-panel remaining-checklist">
          <summary>残っていることの一覧</summary>
          <section aria-labelledby="remaining-title">
            <h2 id="remaining-title" tabIndex={-1}>
              残っていること
            </h2>
            <p>{pending.join('・')}</p>
            <p>
              答えを選ぶことと、もとになる資料を読むことの両方が必要です。補足メモは書かなくてもかまいません。
            </p>
            {complete ? (
              <p>記録はそろいました。報告へ進めます。</p>
            ) : (
              <ul>
                {reviews
                  .filter((review) => !review.recorded || !review.grounded)
                  .map((review) => (
                    <li key={review.taskId}>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => showQuestion(review.taskId)}
                      >
                        問{reviews.indexOf(review) + 1}：
                        {v2.decoding.find((task) => task.id === review.taskId)?.prompt}
                      </button>
                      <span>
                        {review.recorded
                          ? '答えは記録済み。まだ読んでいない資料：'
                          : 'まだ答えを選んでいません。'}
                      </span>
                      {review.evidence
                        .filter((id) => !progress.opened.includes(id))
                        .map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="btn ghost"
                            onClick={() => openDocument(id)}
                          >
                            {current.documents.find((doc) => doc.id === id)?.title}を開く
                          </button>
                        ))}
                    </li>
                  ))}
                {boardReviews(current, progress)
                  .filter((review) => !review.recorded)
                  .map(({ task }) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          setBoardTaskId(task.id);
                          selectTab('board');
                        }}
                      >
                        証拠ボード：{task.title}（まだ記録していません）
                      </button>
                    </li>
                  ))}
                {!v2.board && summary.remainingLinks > 0 && (
                  <li>
                    <button type="button" className="btn ghost" onClick={() => selectTab('board')}>
                      資料の関係を記録する
                    </button>
                  </li>
                )}
                {v2.experiment && !tabDone.experiment && (
                  <li>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => selectTab('experiment')}
                    >
                      ミニ実験の判断を記録する
                    </button>
                  </li>
                )}
                {v2.decision && !tabDone.decision && (
                  <li>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => selectTab('decision')}
                    >
                      意思決定の判断を記録する
                    </button>
                  </li>
                )}
              </ul>
            )}
          </section>
        </details>
      )}

      {/* 記録がそろうと「次にやること」カードが報告ボタンになるので、ここは未完了のときだけ出す。 */}
      {!complete && (
        <div className="stage-switch v2-actions">
          <span>記録しなくても進めます。</span>
          <button type="button" className="btn ghost" onClick={() => game.setStage('article')}>
            調査報告をまとめる →
          </button>
        </div>
      )}

      <details className="v2-guide">
        <summary>遊び方</summary>
        {current.id === 'case-01' && (
          <section className="first-case-guide" aria-labelledby="first-case-guide-title">
            <h2 id="first-case-guide-title">最初の事件で、遊び方を体験しよう</h2>
            <ol>
              <li>資料を開いて読む。まずは「{firstDocument?.title}」から。</li>
              <li>問いの答えを選び、下に出る資料をすべて読む。答えは選ぶと記録されます。</li>
              <li>「証拠ボード」で文に証拠を添える。文の扱いを選び、「文と証拠を記録」を押す。</li>
              <li>
                残りを確かめたら、報告をまとめて提出する。提出すると答えと解説を確認できます。
              </li>
            </ol>
            <p>「根拠あり」「記録あり」は操作が済んだ印です。正解かどうかは提出後に分かります。</p>
          </section>
        )}
        <p>資料を読んで、主張がどこまで当てはまるか、情報がどこから出たのかを確かめましょう。</p>
        <p>何が足りないかを確かめ、仮説を根拠で支えましょう。</p>
        <p>
          反対のことを言う資料にも目を向けましょう。分からない点は分からないままにして整理できます。
        </p>
        <p>予算が足りなくなったら、最初から調査し直せます。</p>
        <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
          {UI.case.retry}
        </button>
      </details>

      {confirmReset && (
        <ConfirmPanel
          title={UI.case.retryConfirmTitle}
          confirmLabel={UI.case.retryConfirm}
          onConfirm={() => {
            dispatch({ type: 'reset' });
            setBlockedDocument(null);
            setActiveTaskId(v2.decoding[0]?.id ?? null);
            setBoardTaskId(undefined);
            setResetEpoch((n) => n + 1);
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        >
          この事件{UI.case.retryConfirmBody}
        </ConfirmPanel>
      )}
      <DocumentDialog
        caseData={current}
        progress={progress}
        documentId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
