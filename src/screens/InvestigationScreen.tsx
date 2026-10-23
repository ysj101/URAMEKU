import { useState } from 'react';
import { useSound } from '../audio/useSound';
import { CalculationDesk } from '../components/CalculationDesk';
import { DocumentDialog } from '../components/DocumentDialog';
import { DocumentGrid } from '../components/DocumentGrid';
import { EvidenceBoard } from '../components/EvidenceBoard';
import { remainingBudget } from '../domain/budget';
import { isDeadEnd } from '../domain/deadEnd';
import type { GameApi } from '../state/useGame';
import '../app/screens/desk.css';

export function InvestigationScreen({ game }: { game: GameApi }) {
  const { current, progress, dispatch } = game;
  const play = useSound();
  const [openId, setOpenId] = useState<string | null>(null);
  const deadEnd = isDeadEnd(current, progress);

  const handleOpen = (documentId: string) => {
    dispatch({ type: 'open-document', documentId });
    // 再開用に最後に開いた資料を記録（MVP-030。スタブでは無い場合がある）
    game.setLastDocument?.(documentId);
    play('paper-flip');
    setOpenId(documentId);
  };

  const handleTogglePin = (documentId: string) => {
    if (!progress.pinned.includes(documentId)) play('evidence-pin');
    dispatch({ type: 'toggle-pin', documentId });
    setOpenId(null);
  };

  const handleRestart = () => {
    if (!window.confirm('この事件の調査途中の記録を最初からやり直しますか？')) return;
    dispatch({ type: 'reset' });
  };

  return (
    <>
      <div className="meter">
        <span>STEP 01 / 資料を調べる</span>
        <span className="budget">
          調査予算：残り {remainingBudget(current, progress)} / {current.budget}
        </span>
      </div>
      <div className="notice">
        最初に何を調べるかは自由です。重要な資料を見落とすと予算が足りなくなります。資料を開いて終わりではなく、ボードに証拠として採用してください。
      </div>
      {deadEnd && (
        <div className="notice" role="status">
          必要な資料を開く調査予算が残っていません。この事件を最初からやり直してください。{' '}
          <button type="button" className="btn ghost" onClick={handleRestart}>
            この事件を最初からやり直す
          </button>
        </div>
      )}
      <h3 className="section-title">
        調査資料{' '}
        <small>
          {progress.opened.length} / {current.documents.length} 件確認済み
        </small>
      </h3>
      <DocumentGrid caseData={current} progress={progress} onOpen={handleOpen} />
      <EvidenceBoard
        caseData={current}
        progress={progress}
        onToggleLink={(documentId) => dispatch({ type: 'toggle-link', documentId })}
      />
      <CalculationDesk
        caseData={current}
        progress={progress}
        onChange={(taskId, value) => dispatch({ type: 'set-calculation', taskId, value })}
      />
      <div className="stage-switch">
        <button type="button" className="btn primary" onClick={() => game.setStage('article')}>
          記事を組み立てる →
        </button>
        <button type="button" className="btn ghost" onClick={handleRestart}>
          この事件を最初から
        </button>
      </div>
      <DocumentDialog
        caseData={current}
        progress={progress}
        documentId={openId}
        onTogglePin={handleTogglePin}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
