# C-2 世界観リデザイン（PC）— デザイン案スナップショット

PCレイアウトを維持したまま、新聞・雑誌コラージュの世界観に寄せた画面案と、そのために作った派生素材。
**いずれも正式アート承認前**。`public/assets` / `assets.manifest.json` には未登録。

- 画面案の原本（編集可能なキャンバス）: https://claude.ai/artifact/DFex2X8WucnSxMop1dj3LD
- `canvas/*.dc.html` はキャンバスのソースの写し。画像は `/_blob/<id>` 参照のため、キャンバス外ではそのまま表示されない。

## 画面

| ファイル | 画面 |
|---|---|
| `canvas/Title.dc.html` | 00 タイトル（現行 prototype には無い追加案） |
| `canvas/Main.dc.html` | 01 調査デスク（メイン画面・上部） |
| `canvas/Document.dc.html` | 02 資料閲覧ダイアログ |
| `canvas/Board.dc.html` | 03 証拠ボード・検証メモ（メイン画面・下部） |
| `canvas/Article.dc.html` | 04 記事作成 |
| `canvas/Result.dc.html` | 05 結果・解説 |

## 派生素材

| パス | 内容 | 元 |
|---|---|---|
| `assets/textures/grain.png` | 紙の粒子オーバーレイ（multiply） | 生成（ノイズ） |
| `assets/textures/stains.png` | 紙のシミ | 生成（ノイズ） |
| `assets/textures/ink.png` / `ink-red.png` | インクのかすれ（文字の background-clip / mask 用） | 生成（ノイズ） |
| `assets/backgrounds/collage-bg-*.jpg` | ページ地・ヘッダー帯・コルクボード | `public/assets/backgrounds/Vintage Newspaper Collage Template Sheet.png` を切り出し2倍拡大 |
| `assets/backgrounds/collage-clip-*.png` | 余白埋め用の透過コラージュ | 同上（白地を除去） |
| `assets/characters/c-*.png` | 網点・インク摩耗・白フチを焼き込んだキャラ | `public/assets/characters/*/poses/*.png`（顔・シルエットは再作画せず加工のみ） |

## 元画像（sources/）

- `sources/collage-template-sheet-v1.png`: 4区画のコラージュ素材シート（1672x941）
- `sources/edge-paper-vertical-source.png`: 縦長ページ用の左右コラージュ背景（1064x1478）。`public/assets/c2-highres/backgrounds/edge-paper-vertical-tile.webp` の元

## 未解決

- コラージュ画像に実在の建物に見えるドームがある。正式採用前に差し替えか除去。
- 縦長背景は低解像度（1064px幅）を上下クロスフェードでタイル化して2倍拡大したもの。つなぎ目にわずかな二重写りがある。
- アプリ本体（React）にはタイトル背景・事件一覧ヘッダー・汎用紙面・証拠ボードを適用済み（`src/app/screens/c2-highres.css`）。キャラ加工・質感・UI の紙表現は未適用。
