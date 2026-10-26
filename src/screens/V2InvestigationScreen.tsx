import { useState } from 'react';
import { DocumentDialog } from '../components/DocumentDialog';
import { DocumentGrid } from '../components/DocumentGrid';
import { InformationDesk } from '../components/InformationDesk';
import { ExperimentDesk } from '../components/ExperimentDesk';
import { DecisionDesk } from '../components/DecisionDesk';
import { V2EvidenceBoard } from '../components/V2EvidenceBoard';
import { canOpenDocument, remainingBudget } from '../domain/budget';
import { isDeadEnd } from '../domain/deadEnd';
import type { GameApi } from '../state/useGame';
import '../app/screens/desk.css';
import '../app/screens/v2-integration.css';

/** V2の操作をJSONの方式から組み立てる。旧計算デスクは表示しない。 */
export function V2InvestigationScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetEpoch, setResetEpoch] = useState(0);
  const v2 = current.v2;
  if (!v2) return null;
  const props = { caseData: current, progress, onAction: dispatch };
  const initialExperiment = Boolean(v2.experiment && !progress.v2?.experiment?.initialChoice);

  return (
    <div className="v2-workspace">
      <div className="meter">
        <span data-focus-target tabIndex={-1}>
          STEP 01 / 資料を調べる
        </span>
        <span className="budget">
          調査予算：残り {remainingBudget(current, progress)} / {current.budget}
        </span>
      </div>
      <p className="notice">
        主張の範囲・出典・欠けている情報を読み、仮説を根拠で支えます。反対の資料にも目を向け、
        分からない点は残したまま整理できます。予算が足りないときは最初から調査し直せます。
      </p>
      {isDeadEnd(current, progress) && (
        <p className="notice" role="status">
          必要な資料を開く調査予算が残っていません。この事件を最初から調査し直せます。
          <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
            この事件を最初からやり直す
          </button>
        </p>
      )}
      {v2.experiment && (
        <section className="v2-panel">
          <ExperimentDesk key={resetEpoch} {...props} />
        </section>
      )}
      {initialExperiment ? (
        <p className="notice">
          まず最初の表示に対する判断を記録します。その後に調査資料を開けます。保留を選んでも構いません。
        </p>
      ) : (
        <>
          <section aria-labelledby="v2-documents">
            <h2 className="section-title" id="v2-documents">
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
          <section className="v2-panel">
            <InformationDesk key={resetEpoch} {...props} />
          </section>
          <section className="v2-panel">
            <V2EvidenceBoard key={resetEpoch} {...props} />
          </section>
          {v2.decision && (
            <section className="v2-panel">
              <DecisionDesk key={resetEpoch} {...props} />
            </section>
          )}
        </>
      )}
      <div className="stage-switch">
        <button type="button" className="btn primary" onClick={() => game.setStage('article')}>
          調査報告をまとめる →
        </button>
        <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
          この事件を最初から
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
        onTogglePin={(documentId) => {
          dispatch({ type: 'toggle-pin', documentId });
          setOpenId(null);
        }}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
