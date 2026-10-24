# ウラメク — アセット台帳（収録ファイルの自動照合）

収録ファイル：**534 点**（同一絵のSVG+PNG・サイズ違いを含むため、すべて別デザインではない）。

| カテゴリ | ファイル数 | 主な用途 |
| --- | ---: | --- |
| `achievements` | 10 | 実績バッジ |
| `audio` | 11 | 合成効果音 |
| `backgrounds` | 20 | ゲーム背景 |
| `c2-highres` | 4 | C-2 高解像度背景（タイトル A 案・事件一覧ヘッダー帯・縦長紙面タイル・コルクボード）。低解像度原画のアップスケールで正式承認前 |
| `brand` | 36 | ロゴ / アプリ・PWAアイコン / OGP / スプラッシュ |
| `cases` | 70 | 5件の事件カバーと資料サムネイル |
| `characters` | 107 | 4人の既存原画・リアクション・アイコン |
| `effects` | 12 | リアクション装飾 |
| `encyclopedia` | 10 | 図鑑ページの説明図 |
| `icons` | 32 | 旧試作の基礎アイコン |
| `props` | 18 | 手帳や紙面小物 |
| `textures` | 12 | 紙質・網点 |
| `tutorial` | 12 | チュートリアル |
| `ui` | 180 | フレーム・ボタン補助・状態ラベル・スタンプ |

## 管理ルール

- **ファイルあり**と**公開品質**は異なる。新規のビジュアルにはアートレビューが必要。
- 動作例・検討用のC-2コンセプトボードは `design/reference` に隔離し、ゲーム画面への直接利用を禁止。
- 4人のリアクション画像は固定原画＋記号の合成。顔を新たに作画した5表情ではない。
- 配信先の実画面スクリーンショットは本番ビルド後に作る。
- 個々のパスとSHA-256は `assets.manifest.json` に記載。
- `c2-highres` の受け取り元（PNG 原寸・比較用の B/C/D 案を含む）は `design/incoming/` に置き、git 管理外。採用分だけ WebP で `public/assets/c2-highres` に入れる。

## 状態別の不足項目

`qa/coverage.json` を参照。未制作・未承認を「完成」と扱わない。

## コードからの参照（MVP-033）

### 用途別ヘルパー `src/data/assets.ts`

TypeScript から画像を参照するときは `"/assets/..."` を直書きせず、`src/data/assets.ts` のヘルパーを使う。
いずれも `import.meta.env.BASE_URL` を付けた URL（`/URAMEKU/assets/...` 等）を返す。
受け付ける名前は `as const` 配列（`BACKGROUND_NAMES` など）で列挙しており、収録されていない名前は型エラーになる。

| ヘルパー | 返すパス | 既定形式 |
| --- | --- | --- |
| `assetUrl(rel)` | `assets/<rel>`（汎用） | — |
| `caseCover(caseId)` / `documentThumbnail(caseId, docId)` | `cases/<id>/cover.*` / `cases/<id>/documents/<doc>.png` | png |
| `characterReaction(id, reaction)` / `characterIcon(id, reaction, size)` | `characters/<id>/reactions/*.png` / `icons/<reaction>-<size>.png` | png |
| `characterPose(id, pose)` | `characters/<id>/poses/<pose>.png`（シノブ以外は `idle` のみ。型で禁止・実行時は例外） | png |
| `backgroundUrl(name)` / `textureUrl(name)` | `backgrounds/*` / `textures/*` | svg |
| `c2HighresUrl(name)` | `c2-highres/*`（`title` / `header` / `paper` / `board`。タイトルは A 案のみ） | webp |
| `encyclopediaArt(id)` / `achievementIcon(id)` / `tutorialStep(n)` | `encyclopedia/*` / `achievements/*` / `tutorial/step-NN.*` | png |
| `uiStamp` / `uiState` / `uiFrame` / `uiGrade` / `uiIllustration` / `uiIcon` / `uiTape(n)` | `ui/<kind>/*` | svg |
| `propUrl(name)` / `effectReaction(name)` | `props/*` / `effects/reactions/*` | svg |

「無いものを有ることにしない」方針により、ヘルパーが返しうる全パスが `assets.manifest.json` に存在し、
かつ名前一覧がマニフェスト上のファイル一覧と一致することを `src/data/assets.test.ts` で検証している
（5 事件 × 6 資料、キャラ 4 人のリアクション／ポーズ／アイコン、図鑑 5、実績 5、背景、テクスチャ、UI 部品）。
音声は `src/audioAssets.ts`（MVP-035）が扱う。

### マニフェスト参照 `src/data/assetManifest.ts`

`assets.manifest.json`（約 200KB）は **アプリのバンドルに含めない**。`assetManifest.ts` は `node:fs` で遅延読み込みする
テスト／スクリプト専用モジュールで、`manifestPaths(): Set<string>`（`public/assets/` 相対）、`isKnownAsset(path)`
（`brand/x.svg` / `/assets/brand/x.svg` / `/URAMEKU/assets/brand/x.svg` / `public/assets/brand/x.svg` のどの表記でも可）を提供する。
実行時コード（テスト以外）から import されていないことは `assetManifest.test.ts` が検査する。

### 参照チェック `npm run check:assets`

`scripts/check_asset_refs.mjs` は `src/**/*.{ts,tsx,css}`・`index.html`・`public/manifest.webmanifest` から
`assets/...` の文字列参照と `assetUrl('...')` の呼び出しを抽出し、`public/` 配下の実在とマニフェスト登録を検査する
（`${...}` を含む動的参照はディレクトリの存在だけ確認し `dyn` と表示）。終了コードは 0/1。

```bash
npm run check:assets                                   # 静的検査（ファイル実在 + マニフェスト登録）
npm run check:assets -- --verbose                      # 参照元ファイル:行 も表示

# 配信中サーバーに対する 200/304 確認（受け入れ条件「各画像パスが 200/304」）
VITE_BASE_PATH=/URAMEKU/ npx vite build
VITE_BASE_PATH=/URAMEKU/ npx vite preview --port 4173 &
npm run check:assets -- --serve http://localhost:4173/URAMEKU/
```

`--serve` は各参照に HEAD を送り、200/304 かつ `text/html` でない（SPA フォールバックに吸われていない）ことを確認する。
`npm run check` には含めていない（CI への組込は別途判断）。
