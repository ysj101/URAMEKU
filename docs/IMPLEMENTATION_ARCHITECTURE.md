# V2アーキテクチャ（現行）

V2は既存React/TypeScript・静的JSON・純粋ドメイン・端末内保存を拡張する。`CaseData.schemaVersion`と`CaseData.v2`でゲーム方式を識別し、`CaseProgress.v2`で方式別状態を保持する。旧計算・固定断片のコードは旧形式互換としてのみ扱う。ゲームの版、事件のrevision、セーブ形式versionは別概念。

- `src/domain/v2Types.ts`: 3方式、根拠、判断、報告、履歴の契約。
- `src/data/validateCase.ts` と `data/schema/case.schema.json`: 版別構造と参照の検証。
- `src/domain/game.ts`: DOM非依存の状態遷移。未読採用、予算、重複、不正操作を拒否する。
- 各方式の純粋関数と共通評価: 事実整合・根拠充足・操作完了・不確実性を分離する。
- `src/components/` と `src/screens/`: JSON方式を描画し、事件別の答え分岐を持たない。
- `src/state/`: 旧記録とV2記録を分離して移行。条件・初回判断・更新を再開し、未知版を黙って破壊しない。

以下は旧MVP構成の履歴。V2のルールは `GAME_RULES.md` を優先する。

---

# 技術設計（Web/PWA-first）

## フェーズ0：既存試作

- `prototype/`: HTML/CSS/JSの静的試作、5事件のJSONを読み込む。デザイン統合前の動作検証用。
- `data/cases/`: 事件の唯一の正本。UIから編集させない。
- `public/assets/`: 画像・音声・ブランドの公開素材。
- `assets.manifest.json`: 各画像と音声のパス/形式/サイズ/ハッシュ。
- `src/data/assets.ts`: 用途別アセット URL ヘルパー。キャラクター表示は `src/components/CharImage.tsx` / `CharacterReaction.tsx` を通す（`docs/CHARACTER_USAGE.md`）。

## フェーズ1：正式MVP

- React + TypeScript + ViteへUI移行（データは静的JSON）。
- `domain/game.ts`: 純粋関数の状態遷移（ケース開始、資料開封、証拠採用、照合、計算、記事、クリア）。
- `domain/scoring.ts`: 合格条件と採点をDOMから分離。
- `state/persistence.ts`: 端末保存とバージョン移行。
- `screens/`: Home, Cases, Desk, Document, EvidenceBoard, Calculator, Article, Result, Encyclopedia, Settings。
- `components/`: CharImage, PaperCard, Stamp, DocumentTile, Pin, Badge, AudioControl。
- 画像は通常`<img>`のパスを参照、読みやすい証拠本文はHTMLで描画。
- 5事件の攻略シナリオをE2Eテスト。公式配信前にPWA manifest/start_urlを配信パスと一致させる。

## セキュリティ

- 実ユーザーデータは収集しない方針のMVP。`localStorage`とJSON読み取りのみ。
- 文書本文はHTMLとして無条件挿入せずエスケープ・DOM APIを利用。
- 外部ライブラリ導入時はライセンス・依存監査を実施。
- CSP/HTTPS/エラー復帰は正式リリース前のP0。
