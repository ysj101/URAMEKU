import { useEffect, useState } from 'react';
import { DocumentDialog } from '../components/DocumentDialog';
import { DocumentGrid } from '../components/DocumentGrid';
import { InformationDesk } from '../components/InformationDesk';
import { ExperimentDesk } from '../components/ExperimentDesk';
import { DecisionDesk } from '../components/DecisionDesk';
import { V2EvidenceBoard } from '../components/V2EvidenceBoard';
import { canOpenDocument, remainingBudget } from '../domain/budget';
import { isDeadEnd } from '../domain/deadEnd';
import { decisionComplete } from '../domain/decision';
import { decodingReviews } from '../domain/decoding';
import { boardReviews } from '../domain/board';
import { experimentComplete } from '../domain/experiment';
import type { CaseData, CaseProgress } from '../domain/types';
import type { GameApi } from '../state/useGame';
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

/** 進捗ストリップに出す数字。すべて progress から導出する */
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
    opened: progress.opened.length,
    total: caseData.documents.length,
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
  const [openId, setOpenId] = useState<string | null>(null);
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

      <div className="v2-progress" aria-label="この事件の進捗">
        <button type="button" className="v2-progress__tile" onClick={() => selectTab('decoding')}>
          <span className="v2-progress__label">資料確認</span>
          <span className="v2-progress__value">
            {summary.opened}
            <small> / {summary.total}</small>
          </span>
        </button>
        <button
          type="button"
          className={`v2-progress__tile ${tabDone.decoding ? '' : 'is-pending'}`}
          onClick={() => selectTab('decoding')}
        >
          <span className="v2-progress__label">読み取り記録</span>
          <span className="v2-progress__value">
            {summary.answered}
            <small> / {summary.tasks}</small>
          </span>
          {summary.remainingTasks > 0 && (
            <span className="v2-progress__todo">
              あと {summary.remainingTasks} 問
              {summary.awaitingEvidence > 0 && `・未読の資料あり ${summary.awaitingEvidence}`}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`v2-progress__tile ${tabDone.board ? '' : 'is-pending'}`}
          onClick={() => selectTab('board')}
        >
          <span className="v2-progress__label">{v2.board ? '文と証拠' : '資料の関係'}</span>
          <span className="v2-progress__value">
            {summary.links}
            <small> 件</small>
          </span>
          {summary.linkTarget > 0 && (
            <span className="v2-progress__todo">
              {v2.board
                ? `${summary.linkTarget} 件の文を確かめる`
                : `${summary.linkTarget} 件以上が目安`}
            </span>
          )}
        </button>
      </div>

      <details className="v2-guide">
        <summary>このステップの進め方</summary>
        <p>
          資料を読んで、主張がどこまで当てはまるか、どこから出た情報か、何が足りないかを確かめ、仮説を根拠で支えます。
          反対のことを言う資料にも目を向けましょう。分からない点は、分からないままにして整理できます。予算が足りなくなったら、最初から調査し直せます。
        </p>
      </details>

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
          <section className="v2-panel">
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
              onOpen={(documentId) => {
                if (!canOpenDocument(current, progress, documentId)) return;
                dispatch({ type: 'open-document', documentId });
                setOpenId(documentId);
              }}
            />
          </section>

          <section className="v2-desk-panel" id="v2-desk-panel" aria-label="デスク">
            <div className="v2-tabs" role="tablist" aria-label="デスクの切り替え">
              {tabs.map((candidate) => (
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
              {tab === 'decoding' && <InformationDesk key={resetEpoch} {...props} />}
              {tab === 'board' && <V2EvidenceBoard key={resetEpoch} {...props} />}
              {tab === 'decision' && v2.decision && <DecisionDesk key={resetEpoch} {...props} />}
            </div>
          </section>
        </div>
      )}

      <div className="stage-switch v2-actions">
        <span className="v2-actions__status">
          {pending.length
            ? `報告の前に：${pending.join('・')}（記録しなくても進めます）`
            : '記録はそろいました。報告へ進めます。'}
        </span>
        <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
          この事件を最初から
        </button>
        <button type="button" className="btn primary" onClick={() => game.setStage('article')}>
          調査報告をまとめる →
        </button>
      </div>

      {confirmReset && (
        <section
          className="notice"
          role="alertdialog"
          aria-label="調査をやり直す確認"
          aria-describedby="v2-reset-description"
        >
          <p id="v2-reset-description">この事件の調査記録を消して、最初からやり直しますか？</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatch({ type: 'reset' });
              setResetEpoch((n) => n + 1);
              setConfirmReset(false);
            }}
          >
            やり直す
          </button>
          <button type="button" className="btn ghost" onClick={() => setConfirmReset(false)}>
            やめる
          </button>
        </section>
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
