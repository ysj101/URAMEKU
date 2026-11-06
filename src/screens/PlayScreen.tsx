import { useState } from 'react';
import { CaseGuidePanel } from '../components/CaseGuidePanel';
import { CaseHeader } from '../components/CaseHeader';
import { CaseMenu, type CaseMenuItem } from '../components/CaseMenu';
import { ConfirmPanel } from '../components/ConfirmPanel';
import { TutorialHint } from '../components/TutorialHint';
import { ArticleScreen } from './ArticleScreen';
import { InvestigationScreen } from './InvestigationScreen';
import { ResultScreen } from './ResultScreen';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';
import { UI } from '../data/ui';
import { caseNumber } from '../data/cases';

/** 1 事件のプレイ画面。調査 → 記事 → 結果を内包する。 */
export function PlayScreen({ game, nav }: { game: GameApi; nav: Navigation }) {
  const { current, progress, stage, dispatch } = game;
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // やり直したら調査画面を作り直し、開いていた問いやタブの選択も初期状態に戻す
  const [resetEpoch, setResetEpoch] = useState(0);
  // 一覧の先頭の事件（CASE 01）の調査中は「次にやること」カードが同じ案内を出すので、段階ヒントを重ねない。
  const nextStepCardShown =
    caseNumber(current.id) === 1 && stage === 'investigate' && !progress.published;
  const investigating = stage === 'investigate' && !progress.published;

  // 補助機能はヘッダーのメニューにまとめる。やり直しは区切り線の下に離す（UI 設計の基本 第 5 章）。
  const menuItems: CaseMenuItem[] = [
    { id: 'guide', label: '遊び方を見る', onSelect: () => setGuideOpen(true) },
    ...(investigating
      ? [
          {
            id: 'article',
            label: '調査報告へ進む（記録が未完でも）',
            onSelect: () => game.setStage('article'),
          },
        ]
      : []),
    { id: 'reset', label: UI.case.retry, danger: true, onSelect: () => setConfirmReset(true) },
  ];

  return (
    <section className="play" aria-labelledby="case-title">
      <div className="screen-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'cases' })}
        >
          ← 事件一覧
        </button>
        <CaseMenu items={menuItems} />
      </div>
      <CaseHeader caseData={current} />
      {guideOpen && <CaseGuidePanel caseData={current} onClose={() => setGuideOpen(false)} />}
      {confirmReset && (
        <ConfirmPanel
          className="notice case-reset-confirm"
          title={UI.case.retryConfirmTitle}
          confirmLabel={UI.case.retryConfirm}
          onConfirm={() => {
            dispatch({ type: 'reset' });
            game.setStage('investigate');
            setResetEpoch((n) => n + 1);
            setConfirmReset(false);
          }}
          onCancel={() => setConfirmReset(false)}
        >
          この事件{UI.case.retryConfirmBody}
        </ConfirmPanel>
      )}
      {!nextStepCardShown && <TutorialHint caseData={current} progress={progress} stage={stage} />}
      <div id="game">
        {progress.published ? (
          <ResultScreen game={game} nav={nav} />
        ) : stage === 'article' ? (
          <ArticleScreen game={game} />
        ) : (
          <InvestigationScreen key={resetEpoch} game={game} />
        )}
      </div>
    </section>
  );
}
