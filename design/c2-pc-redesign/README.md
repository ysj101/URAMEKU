# C-2 世界観リデザイン（PC）— デザイン案スナップショット

PC レイアウトを維持したまま、新聞・雑誌コラージュの世界観に寄せた画面案と、そのために作った派生素材。
**いずれも正式アート承認前**。このフォルダの素材は `public/assets` / `assets.manifest.json` に登録していない。

- 画面案の原本（編集可能なキャンバス）: https://claude.ai/artifact/DFex2X8WucnSxMop1dj3LD
- `canvas/*.dc.html` はキャンバスのソースの写し。画像は `/_blob/<id>` 参照のため、キャンバス外ではそのまま表示されない。

## 画面

| ファイル | 画面 |
| --- | --- |
| `canvas/Title.dc.html` | 00 タイトル（現行アプリのホームとは別の追加案） |
| `canvas/Main.dc.html` | 01 調査デスク（メイン画面・上部） |
| `canvas/Document.dc.html` | 02 資料閲覧ダイアログ |
| `canvas/Board.dc.html` | 03 証拠ボード・検証メモ（メイン画面・下部） |
| `canvas/Article.dc.html` | 04 記事作成 |
| `canvas/Result.dc.html` | 05 結果・解説 |

## 派生素材（assets/）

| パス | 内容 | 元 |
| --- | --- | --- |
| `assets/textures/grain.png` | 紙の粒子オーバーレイ（multiply） | 生成（ノイズ） |
| `assets/textures/stains.png` | 紙のシミ | 生成（ノイズ） |
| `assets/textures/ink.png` / `ink-red.png` | インクのかすれ（文字の background-clip / mask 用） | 生成（ノイズ） |
| `assets/characters/<id>[-<pose>].png` | 網点・インク摩耗・白フチを焼き込んだキャラ | `public/assets/characters/*/poses/*.png`（顔・シルエットは再作画せず加工のみ） |

## 元画像（sources/）

- `sources/paper-side-source.png`: 縦長ページ用の左右コラージュ背景（1064x1478）。`public/assets/c2-highres/paper-side-tile.webp` の元

## アプリへの適用状況

`src/app/screens/c2-highres.css` と `c2HighresUrl()`（`src/data/assets.ts`）で、`public/assets/c2-highres/` の次の素材を使用している。

| ファイル | 用途 |
| --- | --- |
| `title-a.webp` | ホームの全面背景（採用済みタイトル A 案） |
| `header-band.webp` | 事件一覧の見出し帯 |
| `paper-side-tile.webp` | 汎用の紙面（左右コラージュの縦タイル） |
| `paper-frame.webp` | 資料ダイアログの背面（四辺コラージュ） |
| `cork-board.webp` | 証拠ボード |
| `clipping-{corner,vertical,horizontal}.webp` | 結果・図鑑・調査画面の余白の装飾 |

キャラ加工・質感・紙片風の UI は未適用。

## 未解決

- コラージュ画像に実在の建物に見えるドームがある。正式採用前に差し替えか除去。
- 高解像度素材は低解像度原画のアップスケールで、細部の情報量はない。
- 縦長背景は上下クロスフェードでタイル化しており、つなぎ目にわずかな二重写りがある。
