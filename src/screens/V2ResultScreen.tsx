import { useState } from 'react';
import { Debrief } from '../components/Debrief';
import { evaluateV2Case } from '../domain/v2Evaluation';
import { experimentComparison } from '../domain/experiment';
import { decisionOutcome } from '../domain/decision';
import type { Navigation } from '../app/navigation';
import type { GameApi } from '../state/useGame';
import '../app/screens/v2-integration.css';

export function V2ResultScreen({ game, nav }: { game: GameApi; nav: Navigation }) {
  const { current, progress, dispatch } = game;
  const [confirmReset, setConfirmReset] = useState(false);
  const result = evaluateV2Case(current, progress);
  const experiment = experimentComparison(current, progress);
  const outcome = decisionOutcome(current, progress);
  const config = current.v2;
  const state = progress.v2;
  if (!config || !state) return null;
  const tracks = {
    decoding: '情報の読み取り',
    graph: '根拠の関係',
    experiment: '提示条件の比較',
    decision: '判断と更新',
    report: '報告と留保',
  };
  const index = game.cases.findIndex((c) => c.id === current.id);
  const next = game.cases[index + 1];
  const doc = (id: string) => current.documents.find((d) => d.id === id)?.title ?? id;
  const revise = () => {
    dispatch({ type: 'withdraw' });
    game.setStage('investigate');
  };

  return (
    <div className="v2-workspace">
      <div className="meter">
        <span data-focus-target tabIndex={-1}>
          STEP 03 / 判断を振り返る
        </span>
        <span>{result.completed ? '調査記録が整いました' : '確認を続けられます'}</span>
      </div>
      <section className="v2-panel" aria-labelledby="v2-result-title" data-testid="v2-result">
        <h2 id="v2-result-title">
          {result.completed ? '根拠と判断の記録をまとめました' : 'まだ確認できる点があります'}
        </h2>
        <p>
          選んだ方針や反応の違いに、一律の正解は付けません。確認した事実・根拠・不確実な点を見直します。
        </p>
        <dl className="v2-summary">
          {Object.entries(result.tracks)
            .filter(([, value]) => value.total > 0)
            .map(([key, value]) => (
              <div key={key}>
                <dt>{tracks[key as keyof typeof tracks]}</dt>
                <dd>
                  {value.done} / {value.total} 件確認
                </dd>
              </div>
            ))}
        </dl>
        {result.missing.length > 0 && (
          <ul aria-label="確認を続ける項目">
            {result.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <h3>報告に残したこと</h3>
        <p>{state.report.claim}</p>
        <h3>未確認の点・前提や留保</h3>
        <p>{state.report.uncertainty}</p>
        {experiment && (
          <section aria-label="提示条件と反応の記録">
            <h3>提示条件と反応</h3>
            <p>最初の表示：{experiment.condition?.prompt}</p>
            <p>最初の判断：{experiment.initial ?? '未記録'}</p>
            <p>比較後の判断：{experiment.updated ?? '未記録'}</p>
            <p>維持・変更した理由：{experiment.reason || '未記録'}</p>
            <p>一回の反応から個人の特性は判断できません。</p>
          </section>
        )}
        {state.decisions.length > 0 && (
          <section>
            <h3>判断の履歴</h3>
            <ol className="v2-history">
              {state.decisions.map((record, i) => (
                <li key={i}>
                  <strong>
                    {i === 0 ? '最初の判断' : `更新 ${i}`}：
                    {config.decision?.options.find((o) => o.id === record.optionId)?.text}
                  </strong>
                  <p>
                    目的：
                    {config.decision?.objectives.find((o) => o.id === record.objectiveId)?.text}
                  </p>
                  <p>理由：{record.reason}</p>
                  <p>前提：{record.assumptions}</p>
                  <p>支える資料：{record.evidence.map(doc).join('、')}</p>
                  <p>反対の見方・制約：{record.counterEvidence.map(doc).join('、')}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
        {outcome && (
          <section>
            <h3>条件付きの結果</h3>
            <p>{outcome.option.outcome}</p>
            <p>{outcome.option.tradeoff}</p>
            <p>結果の幸不幸だけでは、当時の判断の妥当性は決まりません。</p>
            <details>
              <summary>選ばなかった方針の想定（反実仮想）</summary>
              {outcome.counterfactuals.map((option) => (
                <p key={option.id}>
                  {option.text}：{option.outcome} {option.tradeoff}
                </p>
              ))}
            </details>
          </section>
        )}
        <div className="stage-switch">
          <button type="button" className="btn primary" onClick={revise}>
            調査・判断を見直す
          </button>
          {!progress.revealed && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => dispatch({ type: 'reveal' })}
            >
              資料に沿った解説を開く
            </button>
          )}
          {result.completed && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (next) {
                  game.goToNextCase();
                  nav.navigate({ screen: 'play', caseId: next.id });
                } else nav.navigate({ screen: 'cases' });
              }}
            >
              {next ? '次の事件へ' : '事件一覧へ'}
            </button>
          )}
        </div>
      </section>
      {progress.revealed && (
        <section className="v2-panel" aria-label="資料に沿った解説">
          <h2>資料に沿った解説</h2>
          {config.decoding.map((task) => (
            <section key={task.id}>
              <h3>{task.prompt}</h3>
              {task.options
                .filter((o) => o.accepted)
                .map((option) => (
                  <p key={option.id}>
                    {option.text}
                    <br />
                    {option.reason}
                    <br />
                    根拠：{option.evidence.map(doc).join('、')}
                  </p>
                ))}
            </section>
          ))}
          {result.factualErrors.length > 0 && (
            <ul aria-label="読み取りの確認">
              {result.factualErrors.map((error) => (
                <li key={error.taskId}>
                  {error.message}（{error.evidence.map(doc).join('、')}）
                </li>
              ))}
            </ul>
          )}
          {config.experiment && <p>{config.experiment.explanation}</p>}
          <Debrief caseData={current} />
        </section>
      )}
      <div className="stage-switch">
        <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>
          この事件をもう一度
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'cases' })}
        >
          事件一覧へ戻る
        </button>
      </div>
      {confirmReset && (
        <section role="alertdialog" aria-label="再挑戦の確認" className="notice">
          <p>この事件の調査記録を消して最初からやり直しますか？</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              dispatch({ type: 'reset' });
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
    </div>
  );
}
