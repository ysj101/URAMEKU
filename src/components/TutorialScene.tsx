import type { TutorialScene } from './tutorialScenes';

/**
 * 遊び方画面の左側に置く、調査画面の簡略モック。
 * 手順ごとに場面を切り替え、その手順で触る場所を赤い枠（.ts-target）と吹き出しで示す。
 * 装飾なので aria-hidden。説明は右側の HTML テキストで完結させる（MVP_SPEC 12 章）。
 * 事件データには依存せず、文言はすべて架空の例。
 */
interface Props {
  scene: TutorialScene;
  /** 赤い枠に添える吹き出し（例: 「① ここを押す」） */
  callout: string;
}

export function TutorialScene({ scene, callout }: Props) {
  return (
    <div className="ts-scene" data-scene={scene} aria-hidden="true">
      {scene === 'desk-open' || scene === 'desk-budget' ? (
        <Desk scene={scene} callout={callout} />
      ) : scene === 'dialog-pin' ? (
        <DocumentDialogMock callout={callout} />
      ) : scene === 'board-link' ? (
        <BoardMock callout={callout} />
      ) : scene === 'memo-calc' ? (
        <MemoMock callout={callout} />
      ) : (
        <ArticleMock callout={callout} />
      )}
    </div>
  );
}

function Callout({ text }: { text: string }) {
  return <span className="ts-callout">{text}</span>;
}

function target(active: boolean) {
  return active ? 'ts-target' : undefined;
}

function Desk({ scene, callout }: { scene: 'desk-open' | 'desk-budget'; callout: string }) {
  const budget = scene === 'desk-budget';
  return (
    <div className="ts-paper">
      <div className="ts-header">
        <div>
          <span className="ts-tag">CASE 01</span>
          <span className="ts-title">見出しの向こうの事実</span>
        </div>
        <span className="ts-mascot" />
      </div>
      <div className={`ts-meter ${target(budget) ?? ''}`}>
        <span>STEP 01 / 資料を調べる</span>
        <span className="ts-budget">調査予算：残り {budget ? 4 : 6} / 6</span>
        {budget && <Callout text={callout} />}
      </div>
      <div className="ts-grid">
        <div className={`ts-doc ${target(!budget) ?? ''}`}>
          <span className="ts-kind">チラシ</span>
          <span className="ts-thumb" />
          <span className="ts-doc-title">キャンペーン広告</span>
          <span className="ts-cost ts-cost-free">コスト 0 ・ 未読</span>
          {!budget && <Callout text={callout} />}
        </div>
        <div className="ts-doc ts-doc-blue">
          <span className="ts-kind">台帳</span>
          <span className="ts-thumb" />
          <span className="ts-doc-title">無料体験者の登録台帳</span>
          <span className="ts-cost">コスト 2 ・ {budget ? '読了' : '未読'}</span>
        </div>
        <div className="ts-doc ts-doc-note">
          <span className="ts-kind">切り抜き</span>
          <span className="ts-thumb" />
          <span className="ts-doc-title">地域紙の記事</span>
          <span className="ts-cost">コスト 1 ・ 未読</span>
        </div>
      </div>
      <div className="ts-row">
        <span className="ts-btn ts-btn-primary">記事を組み立てる →</span>
        <span className="ts-btn">この事件を最初から</span>
      </div>
    </div>
  );
}

function DocumentDialogMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper ts-dimmed">
      <div className="ts-dialog">
        <div className="ts-dialog-head">
          <span className="ts-kind">台帳 ・ コスト 2</span>
          <span className="ts-close">×</span>
        </div>
        <span className="ts-title">無料体験者の登録台帳</span>
        <div className="ts-lines">
          <span style={{ width: '92%' }} />
          <span style={{ width: '84%' }} />
          <span style={{ width: '60%' }} />
        </div>
        <div className="ts-row">
          <span className="ts-btn ts-btn-primary ts-target">
            証拠ボードに貼る
            <Callout text={callout} />
          </span>
          <span className="ts-btn">閉じる</span>
        </div>
      </div>
    </div>
  );
}

function BoardMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <div className="ts-meter">
        <span>証拠ボード</span>
        <span>採用証拠 3 件</span>
      </div>
      <div className="ts-board">
        <svg className="ts-thread" viewBox="0 0 300 120" preserveAspectRatio="none">
          <line x1="50" y1="60" x2="150" y2="60" />
        </svg>
        <div className="ts-pin ts-target">
          <span className="ts-pinhead" />
          <span className="ts-doc-title">キャンペーン広告</span>
          <span className="ts-cost">選択中</span>
        </div>
        <div className="ts-pin ts-target">
          <span className="ts-pinhead" />
          <span className="ts-doc-title">無料体験者の登録台帳</span>
          <span className="ts-cost">選択中</span>
          <Callout text={callout} />
        </div>
        <div className="ts-pin">
          <span className="ts-pinhead" />
          <span className="ts-doc-title">地域紙の記事</span>
          <span className="ts-cost">&nbsp;</span>
        </div>
      </div>
      <div className="ts-note">照合：キャンペーン広告 × 無料体験者の登録台帳</div>
    </div>
  );
}

function MemoMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <div className="ts-meter">
        <span>数値検証メモ</span>
        <span>1 / 2 件</span>
      </div>
      <div className="ts-memo">
        <span className="ts-kind">問い 1</span>
        <span className="ts-doc-title">
          広告の「満足度 92%」の分母は何人か。台帳の人数から求めよ。
        </span>
        <div className="ts-row">
          <span className="ts-input ts-target">
            55
            <Callout text={callout} />
          </span>
          <span className="ts-unit">人</span>
          <span className="ts-btn">記録する</span>
        </div>
        <span className="ts-cost">誤差 ±5% まで正解</span>
      </div>
    </div>
  );
}

function ArticleMock({ callout }: { callout: string }) {
  return (
    <div className="ts-paper">
      <div className="ts-meter">
        <span>STEP 02 / 記事を組み立てる</span>
        <span>採用証拠 3 件</span>
      </div>
      <div className="ts-headline">
        <span className="ts-slot ts-slot-filled">無料体験の</span>
        <span className="ts-slot ts-slot-filled">半数が</span>
        <span className="ts-slot ts-target">
          3
          <Callout text={callout} />
        </span>
      </div>
      <div className="ts-chips">
        <span className="ts-chip">継続していない</span>
        <span className="ts-chip">詐欺だった</span>
        <span className="ts-chip">満足度 92%</span>
        <span className="ts-chip">全員が</span>
        <span className="ts-chip">登録を取り消した</span>
        <span className="ts-chip">原因は価格</span>
      </div>
      <div className="ts-row">
        <span className="ts-btn ts-btn-primary">記事を提出して評価を見る</span>
        <span className="ts-btn">← 調査へ戻る</span>
      </div>
    </div>
  );
}
