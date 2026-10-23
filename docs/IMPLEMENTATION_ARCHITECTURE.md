# 技術設計（Web/PWA-first）

## フェーズ0：既存試作

- `prototype/`: HTML/CSS/JSの静的試作、5事件のJSONを読み込む。デザイン統合前の動作検証用。
- `data/cases/`: 事件の唯一の正本。UIから編集させない。
- `public/assets/`: 画像・音声・ブランドの公開素材。
- `assets.manifest.json`: 各画像と音声のパス/形式/サイズ/ハッシュ。
- `src/characterAssets.ts`: React移行時に使うURLヘルパー。現行試作がそのまま呼び出すわけではない。

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
