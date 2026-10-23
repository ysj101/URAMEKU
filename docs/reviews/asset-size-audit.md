# アセット容量監査と遅延読み込みの方針（MVP-043）

- 対象: `assets.manifest.json`（0.6.0-preproduction / 2026-10-24、530 ファイル）
- 計測: `npm run audit:assets`（`scripts/audit_assets_size.mjs`）。数値はこの文書を書いた時点のもので、再計測はコマンドで行う。
- 受け入れ条件: **低速回線で初回の操作を阻害しない。**
- この Issue では画像ファイルの変換・削除・既存コンポーネントの置き換えは行わない。測定・部品（`LazyImage`）・変換スクリプト・手順の提供まで。

## 1. 結論（先に読む）

| 項目                                                      | 現状                           | 判定                   |
| --------------------------------------------------------- | ------------------------------ | ---------------------- |
| アセット合計（manifest）                                  | 18,170 KB                      | 大半は未使用の原画     |
| うちキャラクター（`characters/`）                         | 15,189 KB（83.6%）             | **ここだけが問題**     |
| 初回操作に必要な画像（ホーム＋共通）                      | 1,080 KB / 3G 22.1 秒          | **目標 500 KB 超過**   |
| 　うち装飾（ホームのマスコット `point.png` 1 枚）を除く   | 13 KB / 3G 0.3 秒              | 問題なし               |
| CASE 01 調査画面まで（3 画面合計）                        | 2,253 KB / 3G 46.1 秒          | 超過（原因は同じ 2 枚） |
| JS（1 チャンク）                                          | 204 KB（gzip 66 KB）/ 3G 1.3 秒 | 分割不要               |
| CSS                                                       | 17.6 KB（gzip 4.5 KB）         | 問題なし               |

- 初回表示で重いのは **シノブの原画 2 枚だけ**（ホーム `poses/point.png` 1,066 KB、CASE ヘッダー `poses/idle.png` 1,059 KB。いずれも 1086×1448 px）。表示サイズは最大 140 px 幅・91×98 px なので、画素数が表示の 8〜12 倍ある。
- それ以外の初回画像（favicon、背景 SVG、資料サムネイル 6 枚、状態バッジ）は合計 130 KB 程度で、3G でも 3 秒以内。
- **現状でも操作自体は止まらない**（`<img>` は非同期で、ボタンは画像待ちなしで描画される）。マスコットは `position: absolute`（ホーム）または CSS で固定寸法（CASE ヘッダー 91×98 px、資料タイル 65×78 px）なので、到着時のレイアウト移動も起きない。問題は **帯域の取り合い**で、3G では 1 MB の装飾画像が JS/JSON（70 KB）や資料サムネイル（114 KB）と同じ回線を 20 秒以上占有し、CASE 01 では資料タイルの絵が揃うのが遅れる。
- 対策の優先順は (a) 原画の縮小 WebP 化（効果 98%）→ (b) `LazyImage` でレイアウト確保＋遅延読み込み → (c) それ以外は現状維持。

### 目標値（提案）

| 指標                                                              | 目標            | 根拠                                             |
| ----------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| 初回操作に必要な画像（ホーム＋共通）                              | **500 KB 以下** | 3G 相当 400kbps で 10 秒。JS/CSS 70 KB と合わせて 12 秒以内 |
| 　推奨                                                            | 150 KB 以下     | 3 秒。マスコットを 280 px 幅 WebP にすれば 30 KB |
| 1 画面あたりの追加画像（事件一覧、調査画面）                      | 300 KB 以下     | 遷移後 6 秒以内に揃う                            |
| 画像 1 枚                                                         | 150 KB 以下     | 表示幅の 2 倍（@2x）を上限にする                 |

CI で守るなら `npm run audit:assets -- --budget 500` が目標超過で終了コード 1 を返す（現状は超過するので、原画差し替えの PR で有効化する）。

## 2. 計測結果

### 2.1 種別・ディレクトリ別

| カテゴリ    | 件数 |        合計 |  割合 |
| ----------- | ---: | ----------: | ----: |
| characters  |  107 | 15,188.9 KB | 83.6% |
| cases       |   70 |    702.3 KB |  3.9% |
| brand       |   36 |    583.9 KB |  3.2% |
| ui          |  180 |    460.5 KB |  2.5% |
| backgrounds |   20 |    243.1 KB |  1.3% |
| icons       |   32 |    193.5 KB |  1.1% |
| audio       |   11 |    165.4 KB |  0.9% |
| achievements / tutorial / textures / props / encyclopedia / effects | 74 | 632.6 KB | 3.5% |

形式別: PNG 17,725 KB（320 件）、SVG 280 KB（198 件）、WAV 165 KB（12 件）。**SVG 版が並存するカテゴリ（背景・UI 部品・小物・図鑑・チュートリアル）は SVG を使えば実質ゼロ**。

ディレクトリ別上位: `characters/shinobu` 8,258 KB、`characters/mega` 3,076 KB、`characters/harada` 2,627 KB、`characters/kuro` 1,229 KB。5 位の `cases/case-01` は 144 KB で桁が 2 つ違う。

### 2.2 容量上位 20

上位 20 件は **すべて `characters/`**。

| #   | パス                                      | サイズ     | 画素      |
| --: | ----------------------------------------- | ---------: | --------- |
|   1 | characters/shinobu/poses/point.png        | 1,066.4 KB | 1086×1448 |
|   2 | characters/shinobu/poses/explain.png      | 1,063.8 KB | 1086×1448 |
|   3 | characters/shinobu/poses/inspect.png      | 1,062.8 KB | 1086×1448 |
|   4 | characters/shinobu/poses/idle.png         | 1,058.8 KB | 1086×1448 |
| 5–9 | characters/shinobu/reactions/\*.png（5 種） | 各 574–582 KB | 1024×1024 |
|  10 | characters/mega/poses/idle.png            |   516.3 KB | 1536×2048 |
|  11 | characters/harada/poses/idle.png          |   456.3 KB | 1536×2048 |
| 12–16 | characters/mega/reactions/\*.png（5 種）  | 各 319–324 KB | 1024×1024 |
| 17–20 | characters/harada/reactions/\*.png、kuro/poses/idle.png | 各 270–274 KB | 1024×1024 / 1536×2048 |

### 2.3 初回表示（ホーム → 事件一覧 → CASE 01 調査画面）

参照元: `index.html`、`src/app/global.css`（背景 `url()`）、`src/app/layout.css`、`src/screens/HomeScreen.tsx`、`src/screens/CaseSelectScreen.tsx`、`src/components/CaseHeader.tsx`、`src/screens/InvestigationScreen.tsx`（`DocumentGrid` 経由で `data/cases/case-01.json` の documents を展開）。

| 画面    | パス                                   | サイズ     | 分類          |
| ------- | -------------------------------------- | ---------: | ------------- |
| 共通    | brand/favicon-32.png                   |     1.3 KB | 必要          |
| 共通    | brand/apple-touch-icon.png             |     9.3 KB | 必要（iOS のみ） |
| 共通    | backgrounds/newsprint.svg              |     2.1 KB | 必要          |
| 共通    | backgrounds/desk.svg                   |     0.6 KB | 必要          |
| ホーム  | characters/shinobu/poses/point.png     | 1,066.4 KB | 必要（装飾）  |
| 事件一覧 | ui/states/\*.png（初回は `new` の 1 枚） | 最大 3.7 KB | 後回し可      |
| CASE 01 | characters/shinobu/poses/idle.png      | 1,058.8 KB | 後回し可      |
| CASE 01 | cases/case-01/documents/\*.png（6 枚） |   114.3 KB | 後回し可      |

| 区分                               |     合計   | 3G 相当（400kbps） | 4G 相当（4Mbps） |
| ---------------------------------- | ---------: | -----------------: | ---------------: |
| 初回操作に必要（ホーム＋共通）     | 1,079.7 KB |          22.1 秒   |        2.21 秒   |
| 　うち装飾を除く                   |    13.3 KB |           0.3 秒   |        0.03 秒   |
| 後回し可（事件一覧・CASE 01）      | 1,176.8 KB |          24.1 秒   |        2.41 秒   |
| 初回表示 3 画面の合計              | 2,256.5 KB |          46.2 秒   |        4.62 秒   |

秒数は転送時間のみ（RTT・TLS・HTTP ヘッダは含まない）。実機ではこれに 1〜3 秒を足して考える。

#### 分類の考え方

- **初回操作までに必要**: 操作ボタンが見えるまでに揃っていないと困るもの。ホームでは背景・favicon だけ。マスコットは装飾（alt 付き）で、無くても「はじめる」は押せる。
- **後回しにできる**: 画面遷移後に初めて見えるもの。`loading="lazy"` で視界外なら取得を遅らせ、`width/height` でレイアウトを固定しておけば、到着が遅くても操作は阻害しない。
- 状態バッジ（`ui/states/*.png` 2–4 KB）は 10 種あるが、初回は全事件が `new` なので 1 枚しか転送されない。SVG 版（約 450 B）に切り替えれば更に小さい。

### 2.4 ビルド出力（`npm run build`）

| ファイル                    |   サイズ |   gzip |
| --------------------------- | -------: | -----: |
| dist/index.html             |  0.92 KB | 0.53 KB |
| dist/assets/index-\*.css    | 17.58 KB | 4.47 KB |
| dist/assets/index-\*.js     | 204.05 KB | 66.02 KB |

JS の内訳は react + react-dom（本番ビルド約 130 KB）、事件 JSON 5 件（44 KB、`import.meta.glob` で同梱）、アプリコード。

**`react` のチャンク分割は MVP では不要**と判断する。

- 初回に必要なバイト数は分割しても減らない（vendor と app の両方を取得する）。分割の利点はアプリ更新時の vendor キャッシュ再利用だけで、MVP の配布（GitHub Pages、更新頻度は低く利用者も少ない）では効果が小さい。
- 1 チャンク 66 KB（gzip）は 3G で 1.3 秒。画像 1 枚（1,066 KB）の 1/16 なので、ボトルネックは JS ではない。
- 分割すると HTTP/1.1 環境での並列数と優先度の問題が増える。`vite.config.ts` は変更しない（MVP-004 の `base` 設定のまま）。
- 事件 JSON の遅延読み込み（`import.meta.glob` を `eager: false` に）も 44 KB の節約にしかならず、`CASES` を同期で参照する `useGame.ts` の設計変更が必要なので見送る。

## 3. 提案

### 3.1 キャラクター原画の縮小 WebP 化（最優先・効果 98%）

`scripts/convert_webp.py` を用意した（Pillow 必須。**既定は dry-run** で、`--write` のときも既定の出力先は `public/assets` の外）。顔の再生成はせず、縮小と再エンコードのみ行う（C-2 シルエット維持）。

| 設定                                              | 対象     |    PNG     |   WebP   | 削減   |
| ------------------------------------------------- | -------- | ---------: | -------: | -----: |
| `--quality 82`（等倍）                            | 全 320 件 | 17,725 KB | 3,147 KB | 82.2%  |
| `--filter characters/ --max-width 560`            | 107 件   | 15,189 KB | 1,339 KB | 91.2%  |
| `--filter characters/shinobu/poses/ --max-width 280` | 4 件  |  4,252 KB |    64 KB | 98.5%  |

- 表示幅の上限は 140 px（ホーム）なので @2x でも 280 px で足りる。**`poses/*.png` 1 枚 1,066 KB → 16 KB**。
- `reactions/*.png`（1024×1024）は未使用。使う画面（MVP-022/023 のリアクション表示）が決まってから、表示幅に合わせて `--max-width` を決める。560 px なら 1 枚 30 KB。
- 実行例（検証用、生成物はコミットしない）:

  ```sh
  python3 scripts/convert_webp.py --filter characters/ --max-width 560                     # dry-run
  python3 scripts/convert_webp.py --filter characters/shinobu/poses/ --max-width 280 --write --out-dir /tmp/webp-preview
  ```

- 採用手順（別 PR、人手レビュー必須）:
  1. `--write --in-place` で `public/assets/characters/**/*.webp` を生成し、見た目をアート担当が確認する（`art_review: REQUIRED` のまま）。
  2. `src/data/assets.ts` の `characterPose` / `characterReaction` を `.webp` 返しにする。`<picture>` での PNG フォールバックは不要（対象ブラウザ iOS 14+ / Android Chrome は WebP 対応）。
  3. `assets.manifest.json` を再生成し、`npm run check:assets` と `python3 scripts/validate_assets.py` を通す。
  4. 元の PNG は原画として残すか、`design/` に移すかを決める（`public/` に残すと配布サイズは変わらないが転送はされない）。
- `.gitignore` に `public/assets/**/*.webp` を追加するかは **追加しない**ことを提案する。配布物は `public/` にコミットされている必要があり（静的配信、MVP-045）、ignore すると CI/Pages で欠落する。生成途中の試行は `--out-dir`（既定 `.webp-preview/`）に出すので、ignore するなら `.webp-preview/` の方。

### 3.2 `LazyImage` の組み込み（`src/components/LazyImage.tsx`）

仕様:

- 既定で `loading="lazy" decoding="async"`。`IntersectionObserver` は使わない（標準の lazy で足り、依存も実装も増やさない）。
- `width` / `height` 必須（レイアウト確保。CSS で実寸を上書きしている場合は比率として働くので元画像の画素数を渡せばよい）。
- `priority` で `loading="eager" fetchpriority="high"`。ファーストビューに本当に必要な 1 枚だけに使う。
- 読み込み失敗時は `<img>` を外し、同じ大きさの `--color-surface-aged` 背景の `<span>` に置き換える（`uiIllustration('empty')` などの画像は使わない。失敗した状況でさらに画像を要求しないため）。`alt` が空なら `aria-hidden`、あれば `role="img" aria-label`。

置き換え先（**この PR では置き換えない**。MVP-022/023/026/027/035 の完了後、各画面の担当か後続 Issue で行う）:

| 場所                                     | 現状                                                                 | 置き換え                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `HomeScreen.tsx` `.home-mascot`          | `<img src={assetUrl('characters/shinobu/poses/point.png')} alt=… />` | `<LazyImage … width={1086} height={1448} />`（lazy のまま。装飾なので優先しない。縮小 WebP 後は 280×373）        |
| `CaseHeader.tsx` `.case-mascot`          | `<img … poses/idle.png />`                                           | `<LazyImage … width={1086} height={1448} />`（表示 91×98 px なので `characterIcon('shinobu','idle',256)` 43 KB への差し替えも可） |
| `DocumentGrid.tsx` `.doc-tile img`       | `<img src={documentThumbnail(...)} alt="" />`                        | `<LazyImage … width={440} height={580} />`                                                                      |
| `CaseSelectScreen.tsx` `.case-card-state` | `<img src={assetUrl('ui/states/…png')} alt="" />`                   | `<LazyImage … width={240} height={84} />`（または `uiState(name)` の SVG 版）                                     |
| `Stamp.tsx`                              | SVG 15 KB 前後、演出と同期                                           | 変更不要（演出の同期が崩れるので lazy にしない）                                                                  |

`priority` を付ける候補は現時点では無い（ホームのマスコットは装飾）。ヒーロー画像を置く場合（MVP-040 以降）だけ付ける。

### 3.3 `index.html` の `<link rel="preload">`

**現時点では追加しない。** preload は「HTML 到着直後に必ず要る 1 枚」にだけ効き、現状のホームにその画像は無い（背景 SVG は CSS から即時取得される）。ヒーロー画像を MVP-040 以降で置く場合は、縮小 WebP 化が済んだ後に次の 1 行を `index.html` に足す:

```html
<link rel="preload" as="image" href="/assets/characters/shinobu/poses/point.webp" fetchpriority="high" />
```

（`base` が `/URAMEKU/` のとき `href` は Vite が書き換えないので、`%BASE_URL%` を使うか `assetUrl` と同じ規則で生成すること。）

### 3.4 その他（小さい順に効く）

- SVG 版がある UI 部品・背景・小物は SVG を既定にする（`assets.ts` のヘルパーは既に `format = 'svg'` が既定。`CaseSelectScreen` だけ `.png` を直書きしているので `uiState(name)` に揃える）。
- 音声（WAV 165 KB）は初回表示に含まれない。`src/audio/soundManager.ts` の `preload(id)` は個別呼び出しなので、起動時に全件取得する作りではない（本監査では呼び出し元までは追っていない）。
- `brand/` の OGP・スプラッシュ（各 50–73 KB）は配信されるだけで画面からは参照されない。問題なし。

## 4. 再現手順（低速回線での確認）

1. `npm run build && npm run preview`
2. Chrome DevTools → Network → Throttling「Slow 3G」（約 400kbps）、キャッシュ無効。
3. `http://localhost:4173/` を開き、「はじめる」が押せるまでの時間と、マスコット到着時にボタンが動かないことを確認する。
   - 現状: ボタンは約 2 秒で押せ、レイアウトも動かない（マスコットは `position: absolute`）。ただしマスコットは約 22 秒後に到着し、その間に「事件一覧 → CASE 01」へ進むと資料サムネイルの取得がマスコット 2 枚（計 2.1 MB）の後ろに並ぶ。
   - `LazyImage` 適用後: `width/height` でレイアウトが固定され、視界外の資料タイルは取得が遅延する。帯域の取り合い自体は変わらない。
   - 縮小 WebP 適用後: マスコットも約 0.5 秒で到着し、CASE 01 の全画像が 3G でも 3 秒以内に揃う。
4. `npm run audit:assets -- --budget 500` が終了コード 0 になることを、原画差し替え PR の完了条件にする。

## 5. 未対応・人手が必要な事項

- 画像の変換・差し替え・`assets.manifest.json` の更新は行っていない（上記 3.1 の手順で別 PR）。
- `LazyImage` の既存コンポーネントへの組み込みは行っていない（並行 Issue との競合回避）。
- `scripts/convert_webp.py` は Pillow 13 / libwebp で動作確認済み。品質 82 の見た目はアート担当の確認が必要。
- 実機（iOS Safari / Android Chrome）での低速回線計測は MVP-042 で行う。
