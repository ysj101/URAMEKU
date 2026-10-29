import type { TutorialScene } from './tutorialScenes';

/**
 * 遊び方画面の左側に置く、V2 調査画面の簡略モック。
 * 手順ごとに場面を切り替え、その手順で触る場所を赤い枠（.ts-target）と吹き出しで示す。
 * 装飾なので aria-hidden。説明は右側の HTML テキストで完結させる（MVP_SPEC 12 章）。
 * 事件データには依存せず、文言はすべて架空の例。
 */
interface Props {
  scene: TutorialScene;
  /** 赤い枠に添える吹き出し（例: 「① 出典と範囲を確かめる」） */
  callout: string;
}

export function TutorialScene({ scene, callout }: Props) {
  return (
    <div className="ts-scene" data-scene={scene} aria-hidden="true">
      {scene === 'document-source' ? (
        <DocumentSourceMock callout={callout} />
      ) : scene === 'desk-budget' ? (
        <DeskBudgetMock callout={callout} />
      ) : scene === 'board-link' ? (
        <BoardLinkMock callout={callout} />
      ) : scene === 'experiment' ? (
        <ExperimentMock callout={callout} />
      ) : scene === 'decision' ? (
        <DecisionMock callout={callout} />
      ) : (
        <ReportMock callout={callout} />
      )}
    </div>
  );
}

function Callout({ text }: { text: string }) {
  return <span className="ts-callout">{text}</span>;
}

function Lines({ widths }: { widths: string[] }) {
  return (
    <div className="ts-lines">
      {widths.map((w, i) => (
        <span key={i} style={{ width: w }} />
      ))}
    </div>
  );
}

/** 1. 資料ダイアログ。出典・対象・期間の行を示す */
function DocumentSourceMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper ts-dimmed">
      <div className="ts-dialog">
        <div className="ts-dialog-head">
          <span className="ts-kind">集計表 ・ コスト 1</span>
          <span className="ts-close">×</span>
        </div>
        <span className="ts-title">利用者アンケート 集計</span>
        <dl className="ts-source ts-target">
          <dt>出典</dt>
          <dd>運営会社の自社調査</dd>
          <dt>対象</dt>
          <dd>無料体験の登録者 120 人</dd>
          <dt>期間</dt>
          <dd>先月 1 週間</dd>
          <Callout text={callout} />
        </dl>
        <Lines widths={['92%', '84%', '60%']} />
        <div className="ts-row">
          <span className="ts-btn ts-btn-primary">戻る</span>
        </div>
      </div>
    </div>
  );
}

/** 2. 調査デスク。予算の残りとカードのコスト */
function DeskBudgetMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <div className="ts-meter ts-target">
        <span>STEP 01 / 資料を調べる</span>
        <span className="ts-budget">調査予算：残り 4 / 6</span>
        <Callout text={callout} />
      </div>
      <span className="ts-section">
        調査資料 <small>2 / 6 件確認済み</small>
      </span>
      <div className="ts-grid">
        <div className="ts-doc">
          <span className="ts-kind">チラシ</span>
          <span className="ts-thumb" />
          <span className="ts-doc-title">キャンペーン広告</span>
          <span className="ts-cost">コスト 0 ・ 読了</span>
        </div>
        <div className="ts-doc ts-doc-blue ts-target">
          <span className="ts-kind">台帳</span>
          <span className="ts-thumb" />
          <span className="ts-doc-title">解約者の記録</span>
          <span className="ts-cost ts-cost-free">コスト 2 ・ 未読</span>
        </div>
        <div className="ts-doc ts-doc-note">
          <span className="ts-kind">切り抜き</span>
          <span className="ts-thumb" />
          <span className="ts-doc-title">地域紙の記事</span>
          <span className="ts-cost">コスト 1 ・ 未読</span>
        </div>
      </div>
      <div className="ts-row">
        <span className="ts-btn ts-btn-primary">調査報告をまとめる →</span>
        <span className="ts-btn">この事件を最初から</span>
      </div>
    </div>
  );
}

/** 3. 証拠ボード。文の一部を組み直し、資料の一節を添える */
function BoardLinkMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <span className="ts-section">
        証拠ボード <small>文に証拠を添える</small>
      </span>
      <div className="ts-pins">
        <span className="ts-chip">キャンペーン広告</span>
        <span className="ts-chip">料金決済の集計</span>
        <span className="ts-chip">翌月の継続状況</span>
      </div>
      <div className="ts-form ts-target">
        <span className="ts-legend">広告の対象</span>
        <span className="ts-label">文の気になる部分を押す</span>
        <span className="ts-select">誰についての数字か</span>
        <span className="ts-label">この文に添える証拠</span>
        <span className="ts-select">読んだ資料の一節を選ぶ</span>
        <span className="ts-label">この文をどう扱うか</span>
        <span className="ts-select">直す・残す・まだ判断できない</span>
        <span className="ts-btn ts-btn-primary">文と証拠を記録</span>
        <Callout text={callout} />
      </div>
      <div className="ts-note">
        <strong>記録した内容</strong> 組み立てた文と、その根拠になる資料の一節
      </div>
    </div>
  );
}

/** 4. 見え方のミニ実験。最初の判断の後に、条件を比べて再び判断 */
function ExperimentMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <span className="ts-section">見え方のミニ実験</span>
      <div className="ts-note">
        <strong>最初の判断：</strong>広告の数字どおり、満足度は高い
      </div>
      <div className="ts-form ts-target">
        <span className="ts-legend">提示条件を比べる</span>
        <span className="ts-label">条件 A：満足度 92% ／ 条件 B：回答者 120 人中 25 人が回答</span>
        <span className="ts-legend">比較後の判断（変わらなくても構いません）</span>
        <span className="ts-radio">満足度は高い</span>
        <span className="ts-radio ts-radio-on">回答者が少なく、まだ言い切れない</span>
        <span className="ts-radio">満足度は低い</span>
        <span className="ts-label">維持・変更した理由</span>
        <span className="ts-textarea">回答率が低く、母数が分からないため</span>
        <span className="ts-btn ts-btn-primary">比較後の判断を記録</span>
        <Callout text={callout} />
      </div>
    </div>
  );
}

/** 5. 意思決定シミュレーション。目的・方針・資料・前提をそろえて記録 */
function DecisionMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <span className="ts-section">意思決定シミュレーション</span>
      <span className="ts-fine">行動に使える資源：3。調査予算とは別の制約です。</span>
      <div className="ts-form ts-target">
        <span className="ts-legend">現在の情報での判断</span>
        <span className="ts-label">優先する目的</span>
        <span className="ts-select">解約の原因を確かめる</span>
        <span className="ts-legend">
          方針（どれを選んでも、合っている・まちがっているは付けません）
        </span>
        <span className="ts-radio ts-radio-on">解約者に聞き取りをする（必要資源 2）</span>
        <span className="ts-radio">広告を差し替える（必要資源 3）</span>
        <div className="ts-columns">
          <div>
            <span className="ts-legend">方針を支える資料</span>
            <span className="ts-check ts-check-on">解約者の記録</span>
            <span className="ts-check">キャンペーン広告</span>
          </div>
          <div>
            <span className="ts-legend">反対の見方・制約を示す資料</span>
            <span className="ts-check">解約者の記録</span>
            <span className="ts-check ts-check-on">キャンペーン広告</span>
          </div>
        </div>
        <span className="ts-label">この判断が成り立つ前提・不確実な点</span>
        <span className="ts-textarea">解約者が回答してくれること</span>
        <span className="ts-btn ts-btn-primary">判断を記録</span>
        <Callout text={callout} />
      </div>
    </div>
  );
}

/** 6. 調査報告。確認できたことと未確認の点を分けて提出 */
function ReportMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <div className="ts-meter">
        <span>STEP 02 / 調査報告をまとめる</span>
        <span>読んだ資料 3 件</span>
      </div>
      <span className="ts-section">根拠と、まだ決めきれないことを添えた報告</span>
      <div className="ts-form ts-target">
        <span className="ts-label">確認できたこと・採る方針</span>
        <span className="ts-textarea">
          満足度 92% は回答者 25 人の数字。解約者の記録と食い違う。
        </span>
        <span className="ts-label">未確認の点・前提・まだ決めきれないこと</span>
        <span className="ts-textarea">未回答の 95 人の満足度は分からない。</span>
        <Callout text={callout} />
      </div>
      <div className="ts-row">
        <span className="ts-btn ts-btn-primary">報告を提出して振り返る</span>
        <span className="ts-btn">← 調査へ戻る</span>
      </div>
    </div>
  );
}
