# C-2 正本とのアートレビュー（MVP-034）

- 正本: `design/reference/c2-canonical-board.png`（切り出し: `design/reference/{shinobu,mega,kuro,harada}.png`）
- 対象: `public/assets/characters/{shinobu,mega,kuro,harada}/{poses,reactions,icons}` 全 107 枚
- 補助ツール: `python3 scripts/compare_characters.py`（PIL のみ・読み取り専用。画像は生成も編集もしない）
- 並列表示: `previews/characters.html`（静的。`file://` で開ける）
- 承認台帳: `qa/art-review.json`（`status: pending | approved | rejected`）
- **現在の状態: 目視承認は未実施。`approved` は 0 件、全 107 枚が `pending`。** 本書の「判定」は AI による事前レビューであり、受け入れ条件「4 人のシルエット・素材配置を目視承認」は人間の承認者が `qa/art-review.json` を更新した時点で満たされる。

## 0. 前提（ART_BIBLE / README「アート方針」より）

- キャラの再解釈禁止。髪・眼鏡・猫の耳・部長の帽子は既存マスターに固定。
- `reactions/` と `icons/` は「基準の顔を再作画せず記号を重ねた表情補助状態」。表情差分の正式原画ではない。
- メガ・クロ・ハラダ部長の独立全身ポーズは元から不足。ZIP に無いものを有ることにしない（`design/source-character-manifest.json`: `notACompleteCharacterSet: true`、3 人は `idle` のみ）。
- シノブの追加 3 ポーズはリグ合成（`design/character-rig/shinobu/`）。`limits` に「顔と胴は原画そのまま、手と腕は新規に描いた紙切りベクター」と明記。
- 本番承認は人の目と実端末で行う。

## 1. 計測方法

`scripts/compare_characters.py` の出力。詳細は同スクリプト冒頭の docstring を参照。

| 指標 | 意味 |
| --- | --- |
| IoU full | 正本の切り出し（紙地からの色距離でマスク化）と収録画像（アルファ > 64）を bbox で切り出し、上端・中央揃えで 256px に正規化して重ねた IoU。正本は胸像なので全身ポーズでは必ず低く出る |
| IoU upper | 収録画像を正本と同じ縦横比の上半身だけに切ってから重ねた IoU（胸像どうしの比較） |
| bbox 比 | 収録画像 bbox の縦横比 ÷ 正本 bbox の縦横比 |
| 主色距離 | 前景画素の RGB 4×4×4 ヒストグラムの 0.5·L1 距離（0 = 同一） |
| 差分(対 idle) | 同キャラ `reactions/idle.png` との差分画素率と、差分が右上バッジ領域（x ≥ 60%, y ≤ 40%）に収まるか |
| 頭部変化 | シノブのみ。`rig/layers/head_original.png` の不透明部に master との差分があるか（0 なら顔は無改変） |
| 自動 | 機械計測だけの暫定フラグ（IoU upper < 0.55 または主色距離 > 0.5 または差分がバッジ外 → `check`）。**最終判定ではない** |

正本ボード上の対応領域（`--relocate` で探索、1536×1024 座標）: シノブ `[539, 60, 707, 251]`、メガ `[720, 69, 876, 255]`、クロ `[884, 91, 1040, 250]`、ハラダ部長 `[1041, 70, 1197, 252]`。`design/reference/<id>.png` はこの領域の拡大で、`kuro.png` の右端にはボード上の別の紙片が写り込むため x < 600 で切って比較した。

## 2. 計測結果

### ポーズ・リアクション

| 画像 | サイズ | IoU full | IoU upper | bbox 比 | 主色距離 | 差分(対 idle) | 備考 | 自動 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `shinobu/poses/idle.png` | 1086x1448 | 0.340 | 0.615 | 0.483 | 0.172 | - | master と画素一致（差分なし） | ok |
| `shinobu/poses/point.png` | 1086x1448 | 0.369 | 0.552 | 0.565 | 0.176 | - | master 差分 [685, 368, 983, 747] / 頭部変化 0px | ok |
| `shinobu/poses/inspect.png` | 1086x1448 | 0.354 | 0.628 | 0.525 | 0.174 | - | master 差分 [686, 505, 932, 747] / 頭部変化 0px | ok |
| `shinobu/poses/explain.png` | 1086x1448 | 0.358 | 0.611 | 0.536 | 0.176 | - | master 差分 [685, 430, 945, 747] / 頭部変化 0px | ok |
| `shinobu/reactions/idle.png` | 1024x1024 | 0.582 | 0.614 | 0.791 | 0.191 | - | | ok |
| `shinobu/reactions/{happy,surprised,thinking,worried}.png` | 1024x1024 | 0.582 | 0.614 | 0.791 | 0.191 | 2.39% / バッジ内 | 下地は idle と同一 | ok |
| `mega/poses/idle.png` | 1536x2048 | 0.274 | 0.484 | 0.514 | 0.304 | - | | check |
| `mega/reactions/idle.png` | 1024x1024 | 0.528 | 0.474 | 0.811 | 0.350 | - | | check |
| `mega/reactions/{happy,surprised,thinking,worried}.png` | 1024x1024 | 0.528 | 0.474 | 0.811 | 0.350 | 2.39% / バッジ内 | 下地は idle と同一 | check |
| `kuro/poses/idle.png` | 1536x2048 | 0.495 | 0.629 | 0.828 | 0.057 | - | | ok |
| `kuro/reactions/idle.png` | 1024x1024 | 0.553 | 0.553 | 1.039 | 0.062 | - | | ok |
| `kuro/reactions/{happy,surprised,thinking,worried}.png` | 1024x1024 | 0.553 | 0.553 | 1.039 | 0.062 | 2.39% / バッジ内 | 下地は idle と同一 | ok |
| `harada/poses/idle.png` | 1536x2048 | 0.274 | 0.437 | 0.568 | 0.305 | - | | check |
| `harada/reactions/idle.png` | 1024x1024 | 0.425 | 0.438 | 0.933 | 0.312 | - | | check |
| `harada/reactions/{happy,surprised,thinking,worried}.png` | 1024x1024 | 0.425 | 0.438 | 0.933 | 0.312 | 2.39% / バッジ内 | 下地は idle と同一 | check |

### アイコン（80 枚）

全 80 枚が同名 `reactions/*.png` の LANCZOS 縮小と平均絶対差 0.000（純粋な縮小。再作画なし）。したがってアイコンの判定は元リアクションの判定に従う。

### 機械計測から言えること

- 4 人のリアクション 20 枚は、`idle` との差分が右上のバッジ（画素率 2.39%、全キャラ同一値 = 同じバッジ素材）に限られ、**顔の線は変わっていない**。
- シノブの追加 3 ポーズは、master との差分が右腕領域（x ≥ 685, y 368〜747）に限られ、**頭部レイヤー内の変化は 0 画素**。顔は無改変。
- メガ・ハラダ部長の `check` は、正本が胸像で収録画像が全身であること、紙地の色味の差、正本側の網点ノイズが主因であり、機械計測だけでは「別人化」とは判断できない。目視で判断した（次節）。

## 3. 目視レビュー（AI 事前レビュー）

`previews/characters.html` と、正本・収録画像の頭部拡大を実際に見た結果。**承認ではない。** 人間の承認者が確認すべき点を「要確認」として挙げる。

### シノブ

| 画像 | 判定 | 所見 |
| --- | --- | --- |
| `poses/idle.png` | 問題なし（要承認） | `design/character-rig/shinobu/source/master_shinobu.png` と画素一致。鋭い黒髪の紙型・赤い書類・ペン・赤い差し色が正本と一致 |
| `poses/point.png` / `inspect.png` / `explain.png` | **要確認（軽）** | 顔・髪・胴は原画のまま。右腕のみベクター合成で、`point` はペンを持たず指差し、`inspect` は虫眼鏡、`explain` は手を広げる。ペンが消える点と、腕の質感（ベタ黒のベクター）が原画の紙コラージュ質感と揃っているかを 200% 表示で確認 |
| 全身（4 ポーズ共通） | **要確認（軽）** | 正本はいずれも胸像で、スカート・脚・靴は正本に存在しない。下半身は `master_shinobu.png` 由来であり再作画ではないが、「正本に無い部分」として承認者が目視で OK を出す必要がある |
| `reactions/*.png` | 問題なし（要承認） | 下地は master の胸像トリミング。バッジ以外は idle と同一 |
| `icons/*` | reactions に従う | 64px でも帽子風の髪型・赤い書類のシルエットが読める |

### メガ

| 画像 | 判定 | 所見 |
| --- | --- | --- |
| `poses/idle.png` | **要確認（中）** | 丸眼鏡・眉の一筆・小さな口・角張った髪は正本と一致し別人化はしていない。相違点: (1) 正本は大きな新聞紙を両手で広げるが、収録画像は青い棒グラフ入りの報告書を持つ（小物の差し替え）。(2) 髪の左側のグレー面が正本より大きく、網点のコラージュ質感がフラットな面に置き換わっている。(3) 全身・脚・靴は正本に無い |
| `reactions/*.png` | **要確認（中）** | `poses/idle.png` と同じ描き起こしの胸像。上記 (1)(2) が同様に当てはまる |
| `icons/*` | reactions に従う | |

### クロ

| 画像 | 判定 | 所見 |
| --- | --- | --- |
| `poses/idle.png` | 問題なし（要承認） | 三角の耳 2 つ、白い縦長の目、小さな鼻、右に伸びる尻尾、黒一色のシルエット。正本よりやや角張っているが紙切りとして自然。主色距離 0.057 で色も一致 |
| `reactions/*.png` | **要確認（重）** | **目の下（y ≈ 594）で水平に切れており、鼻・口・胴・尻尾が無い。** 1024×1024 の下半分が空。正本の「座った黒猫」のシルエットが成立しておらず、「画面下から覗く」演出意図なのか切り出しミスなのかを確認する必要がある。他 3 人の reactions は胸像なので、並べたときにクロだけ頭頂部だけになる |
| `icons/*` | **要確認（重）** | 上記のトリミングをそのまま縮小しているため、64px では「耳と点 2 つ」になりクロと判別しにくい |

### ハラダ部長

| 画像 | 判定 | 所見 |
| --- | --- | --- |
| `poses/idle.png` | **要確認（軽）** | 帽子・口ひげ・赤いパイプ・黒いスーツ・ネクタイは正本と一致。相違点: 正本はパイプを口元に当てるが、収録画像は右手で顔から離して持ち、左脇に書類を抱える。髪の生え際と頬の形はやや直線的だが別人化ではない。全身・脚は正本に無い |
| `reactions/*.png` | 問題なし（要承認） | `poses/idle.png` と同じ描き起こしの胸像。バッジ以外は idle と同一 |
| `icons/*` | reactions に従う | 64px でも帽子と口ひげが読める |

### 4 人共通: バッジ記号

| 対象 | 判定 | 所見 |
| --- | --- | --- |
| `reactions/happy.png`（4 枚）と派生 `icons/happy-*.png`（16 枚） | **要確認（重）** | **`happy` のバッジが「四角の中に ×」の記号になっており、喜びとして読めない。** 生成時のフォント未収録（いわゆる豆腐）の可能性が高い。正本の表情例「喜び」は目を閉じて開いた口で、記号系なら `effects/reactions/idea.svg` 等の方向が想定される。意図した記号なら理由を台帳に残す |
| `surprised`（!）/ `thinking`（?）/ `worried`（…） | 問題なし（要承認） | 記号は読める。正本の表情例（驚き・考え中・困り顔）と対応する |
| バッジの位置・大きさ | 問題なし（要承認） | 4 人とも同じ位置・同じ大きさ（右上）。顔に被らない |

## 4. 要確認リスト（優先順）

| # | 重さ | 対象 | 枚数 | 確認すること |
| --- | --- | --- | --- | --- |
| 1 | 重 | `*/reactions/happy.png`, `*/icons/happy-*.png` | 20 | 「四角に ×」のバッジが意図通りか。意図外なら差し替え（**顔を再生成せず、バッジ層だけ**） |
| 2 | 重 | `kuro/reactions/*.png`, `kuro/icons/*` | 25 | 目の下で切れた構図が意図通りか。意図外なら `kuro/poses/idle.png` から胸像を切り出し直す（再作画不要） |
| 3 | 中 | `mega/poses/idle.png`, `mega/reactions/*.png`, `mega/icons/*` | 26 | 小物（新聞 → グラフ報告書）と髪のグレー面を正本と比べて許容するか |
| 4 | 軽 | `harada/poses/idle.png` | 1 | パイプの持ち方・書類の有無を許容するか |
| 5 | 軽 | `shinobu/poses/{point,inspect,explain}.png` | 3 | 合成腕の質感とペンの消失を許容するか |
| 6 | 軽 | 全身ポーズ 7 枚 | 7 | 正本に存在しない下半身（スカート・脚・靴）の承認 |

機械計測で問題なし・目視でも問題なしとした画像（シノブ reactions/icons 24 枚、クロ `poses/idle.png`、ハラダ部長 reactions/icons 24 枚 など）も、**承認者の目視が済むまで `pending` のまま**。

## 5. 素材配置（SCREEN_ASSET_MATRIX と `src/` の整合）

`docs/SCREEN_ASSET_MATRIX.md` のキャラ・背景・小物の計画と、`grep -rn "characterPose\|characterReaction\|backgroundUrl\|assetUrl(" src` の結果。

| 画面 | 計画（SCREEN_ASSET_MATRIX） | 現在の `src/` | 整合 |
| --- | --- | --- | --- |
| タイトル・ホーム | `characters/shinobu/poses/idle.png`, `backgrounds/scene-menu.svg`, `brand/*` | `src/screens/HomeScreen.tsx`: `assetUrl('characters/shinobu/poses/point.png')`（`.home-mascot`、幅 72〜140px）。背景は `global.css` の `backgrounds/newsprint.svg` | **不一致（軽）**: ポーズが `idle` ではなく `point`。背景が `scene-menu` ではなく `newsprint` |
| 事件導入 | `backgrounds/scene-office.svg`, `characters/harada/poses/idle.png`, `tutorial/step-01.png` | 独立した導入画面は無く、`src/components/CaseHeader.tsx` が `characters/shinobu/poses/idle.png`（`.case-mascot`） | **不一致（中）**: ハラダ部長が登場しない。さらに `.case-mascot` は `width: 91px; height: 98px`（モバイル 64×70）の固定で `object-fit` 指定が無く、3:4 の原画が約 1:1 に**潰れて表示される**（シルエット崩れ）。修正は MVP-035 の範囲 |
| 調査デスク | `backgrounds/scene-office.svg`, `cases/<id>/documents/<docid>.png`, `ui/icons/{inspect,pin,budget}.svg` | `src/components/DocumentGrid.tsx`: `documentThumbnail()`。背景は `global.css` の `backgrounds/desk.svg` | 部分一致: 資料サムネイルは一致。背景は `scene-office` ではなく `desk` |
| 資料閲覧 / 証拠ボード / 計算デスク / 記事作成 | `ui/frames/*`, `ui/stamps/*`, `props/*`, `effects/reactions/*` | `src/components/Stamp.tsx`（`stampAssetPath`）のみ。`props/*`、`effects/reactions/*`、`ui/frames/*` は未参照 | 未実装（キャラ画像は使わない計画なので本レビューの対象外） |
| 結果・種明かし | `ui/grades/*.svg`, `ui/stamps/{accepted,rejected}.svg`, `effects/reactions/*.svg` | `src/screens/ResultScreen.tsx`: グレードはテキスト、スタンプは `Stamp.tsx` | 部分一致。`effects/reactions/*` 未参照 |
| キャラのリアクション・アイコン | 計画表に明示なし（`reactions/` は「結果・種明かし」のキャラ演出想定） | `characterReaction` / `characterIcon`（`src/data/assets.ts`）はどの画面からも未参照。`src/AssetImage.tsx` と旧 `src/characterAssets.ts` は定義のみで未使用 | 未使用。`reactions/` 20 枚・`icons/` 80 枚は現状どこにも表示されない |

補足:

- `src/characterAssets.ts`（旧）と `src/data/assets.ts`（新）が同名の `characterPose` / `characterIcon` を二重に定義している。旧側は `pose: string` で型による禁止が無い。MVP-035 で旧側を削除するのが筋だが、本 Issue のスコープ外なので触っていない。
- `docs/MVP_SPEC.md` 9 章は「メガ: 四角い眼鏡と青い差し色」と書くが、正本と `docs/ART_BIBLE.md` は「丸眼鏡」。収録画像は丸眼鏡で正本に合っている。仕様書側の記述ずれとして別途修正が必要（本 PR では編集していない）。
- `qa/coverage.json` の「基本4人の立ち絵」「リアクション全20組」は `file_present_or_complete: true` だが、これはファイル存在の意味であり、本番項目「全員の高解像度独立ポーズと表情の正式原画」は `false` のまま。本レビューはその状態と矛盾しない。

## 6. 承認フロー（誰が・どうやって `approved` にするか）

1. **承認者**: アートディレクター（C-2 正本の管理者）1 名。不在の場合はプロダクトオーナーが代行し、`reviewer` にその旨を書く。AI・スクリプトは `approved` を設定しない。
2. **準備**: `previews/characters.html` をブラウザで開く（`file://` で可）。100% と 200% 表示、スマホ実機（またはデバイスモード）でも確認する（ART_BIBLE「コミット前のアートQA」3 項）。
3. **判定**: 画像ごとに `qa/art-review.json` の該当 `items[]` を編集する。
   - `status`: `approved` / `rejected` のいずれか。`pending` のまま残してよいのは未確認のものだけ。
   - `reason`: 承認なら一言（例「正本と一致」）、却下なら何が違うか（例「happy バッジが豆腐」）。
   - `reviewer`: 承認者の名前またはハンドル。`reviewed_at`: `YYYY-MM-DD`。
   - `metrics` / `auto_flag` / `visual_flag` / `visual_note` はスクリプトと事前レビューの出力で、承認者は上書きしてよいが削除しない。
4. **再計測**: 画像を差し替えた場合は `python3 scripts/compare_characters.py --review qa/art-review.json` を再実行する。スクリプトは `status` / `reason` / `reviewer` を変更せず、計測値だけ更新する。差し替え後の画像は `status` を手で `pending` に戻す。
5. **完了条件**: `summary.pending == 0` かつ `summary.rejected` の各項目に対処方針（差し替え Issue 番号）が `reason` に書かれていること。`rejected` が残る間は `docs/RELEASE_CRITERIA.md` の本番ビジュアル項目を通さない。
6. **禁止事項**: 顔・髪・眼鏡・耳・帽子の再生成（AGENTS.md）。差し替えは「バッジ層の差し替え」「既存原画からの切り出し直し」「配置・CSS の修正」に限る。

## 7. 実行したコマンド

```
python3 scripts/compare_characters.py --review qa/art-review.json
python3 scripts/validate_assets.py   # problems: []
```
