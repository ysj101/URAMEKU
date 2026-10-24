# 調査資料サムネイル 30 枚の識別性レビュー（MVP-036）

- 対象: `public/assets/cases/case-0N/documents/<id>.png`（5 事件 × 6 枚 = 30 枚）
- 計測: `python3 scripts/review_document_thumbnails.py`（PIL で読み取りのみ。画像は編集・生成していない）
- 目視: `previews/documents.html`（30 枚を事件ごとに並べ、ラベル付き／ラベルなし／ゲーム内サイズ 65×78px で切り替え）
- 判定: **画像だけでは事件・資料を識別できない。識別は HTML テキストラベル（`src/components/DocumentLabel.tsx`）で担保し、画像自体の改善は手動レビュー対象として提案に留める**（AGENTS.md: 未レビューのアセットはリリース承認外）。

## 0. 結論

| 観点 | 結果 |
| --- | --- |
| 事件 ID | **30 枚すべて画像に含まれない**。ヘッダー帯は全枚「URAMEKU / ARCHIVE」で共通 |
| 資料 ID | 画像内の「DOCUMENT 0N」は並び順の通し番号で、`id`（`trial` など）は含まれない。440×580px で約 9px 高の極小文字のため、ゲーム内表示 65×78px では判読不能 |
| 閲覧本文 | 本文は罫線（灰色のダミー行）で、意味のある文字は資料タイトル 1 行のみ。本文は `content` を HTML テキストで表示する前提（MVP_SPEC 12 章）なので画像側には不要 |
| 事件間の見分け | 同じ並び順の資料は事件が違っても **ほぼ同一**（16×16 グレースケール平均絶対差 0.8〜1.3、ヒストグラム交差 0.99 以上） |
| 事件内の見分け | 下部モチーフは 3 種しかなく、6 枚のうち 1・4 枚目、2・5 枚目、3・6 枚目が同モチーフ |
| 種別（visual）との一致 | 下部モチーフは `visual` ではなく **並び順** で決まっている。期待モチーフとの不一致 18/30 枚 |

受け入れ条件「事件 ID・資料 ID・閲覧本文を視認可能に」は、画像内文字に依存しない `DocumentLabel`（事件 ID・資料番号・資料 ID・種別・コストをテキスト表示）で満たす。

## 1. 個別計測

全 30 枚: 440×580px RGB、平均輝度 213.7〜220.3（差 6.6 以内）、主色は紙白 `#fff9ef`（61〜66%）、地 `#f5f0e6`（14%）、黒帯 `#242322`（9〜10%）で共通。差し色は下部の赤（`#cf4b4b` 系）または青（`#487d93` 系）のみ。

下部モチーフの判定法: 下部 30% 領域の赤・青画素比率と、赤画素の外接矩形充填率（帯なら高い、輪なら低い）。

| 事件 | # | 資料ID | visual | コスト | 輝度 | 下部モチーフ | 期待 | 判定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| case-01 | 1 | ad | advert | 0 | 215.4 | red-bar | red-bar |  |
| case-01 | 2 | trial | ledger | 1 | 216.3 | blue-bars | blue-bars |  |
| case-01 | 3 | paid | receipt | 1 | 219.3 | red-ring | red-ring |  |
| case-01 | 4 | retained | report | 1 | 214.4 | red-bar | none | 不一致 |
| case-01 | 5 | memo | clipping | 1 | 215.7 | blue-bars | none | 不一致 |
| case-01 | 6 | reviews | news | 1 | 219.9 | red-ring | red-ring |  |
| case-02 | 1 | poster | advert | 0 | 214.6 | red-bar | red-bar |  |
| case-02 | 2 | launch | ledger | 1 | 216.9 | blue-bars | blue-bars |  |
| case-02 | 3 | history | report | 1 | 218.7 | red-ring | none | 不一致 |
| case-02 | 4 | stock | receipt | 1 | 214.2 | red-bar | red-ring | 不一致 |
| case-02 | 5 | interview | clipping | 1 | 216.6 | blue-bars | none | 不一致 |
| case-02 | 6 | competitor | news | 1 | 219.4 | red-ring | red-ring |  |
| case-03 | 1 | headline | news | 0 | 215.2 | red-bar | red-ring | 不一致 |
| case-03 | 2 | count | report | 1 | 216.2 | blue-bars | none | 不一致 |
| case-03 | 3 | invite | clipping | 1 | 219.0 | red-ring | none | 不一致 |
| case-03 | 4 | population | ledger | 1 | 214.0 | red-bar | blue-bars | 不一致 |
| case-03 | 5 | other | report | 1 | 215.9 | blue-bars | none | 不一致 |
| case-03 | 6 | comments | news | 1 | 219.9 | red-ring | red-ring |  |
| case-04 | 1 | minutes | news | 0 | 214.6 | red-bar | red-ring | 不一致 |
| case-04 | 2 | spent | receipt | 1 | 217.3 | blue-bars | red-ring | 不一致 |
| case-04 | 3 | finish | report | 1 | 219.1 | red-ring | none | 不一致 |
| case-04 | 4 | switch | report | 1 | 214.4 | red-bar | none | 不一致 |
| case-04 | 5 | risk | clipping | 1 | 217.8 | blue-bars | none | 不一致 |
| case-04 | 6 | team | news | 1 | 220.3 | red-ring | red-ring |  |
| case-05 | 1 | graphic | advert | 0 | 214.3 | red-bar | red-bar |  |
| case-05 | 2 | raw | ledger | 1 | 217.7 | blue-bars | blue-bars |  |
| case-05 | 3 | axis | report | 1 | 219.3 | red-ring | none | 不一致 |
| case-05 | 4 | questions | clipping | 1 | 213.7 | red-bar | none | 不一致 |
| case-05 | 5 | press | news | 1 | 218.4 | blue-bars | red-ring | 不一致 |
| case-05 | 6 | rumor | news | 1 | 219.8 | red-ring | red-ring |  |

「期待」は `visual` ごとにサムネイルに期待するモチーフ（広告=帯、台帳=棒グラフ/表、決済・記事=印、報告書・切り抜き=文章のみ）。一致している 12 枚は、CASE 01 の並び（advert, ledger, receipt, …）にテンプレートが合わせて作られ、他事件も同じ順番でモチーフが割り当てられた結果の偶然の一致で、種別を描き分けた結果ではない。

## 2. 見分けにくいペア

閾値: 16×16 グレースケール平均絶対差（grayMad）≦ 8.0。全 435 ペア中 **411 ペア** が閾値以下（ほぼ全組み合わせ）。以下は特に近いもの。

### 2.1 同一事件内（grayMad 2.0 未満 = 同モチーフかつタイトル文字数が近い）

| 資料A | 資料B | grayMad | hist交差 | 共通点 |
| --- | --- | --- | --- | --- |
| case-02/poster | case-02/stock | 1.15 | 0.995 | 赤帯。広告と在庫記録が同じ見た目 |
| case-04/minutes | case-04/switch | 1.30 | 0.998 | 赤帯。議事録と見積りが同じ見た目 |
| case-05/graphic | case-05/questions | 1.32 | 0.994 | 赤帯。グラフ広告と設問記録が同じ見た目 |
| case-01/paid | case-01/reviews | 1.34 | 0.992 | 赤印。決済集計と利用者の声が同じ見た目 |
| case-05/axis | case-05/rumor | 1.62 | 0.996 | 赤印 |
| case-02/history | case-02/competitor | 1.66 | 0.992 | 赤印 |
| case-03/headline | case-03/population | 1.70 | 0.992 | 赤帯 |
| case-01/ad | case-01/retained | 1.77 | 0.993 | 赤帯。広告と継続状況（核心資料）が同じ見た目 |
| case-04/finish | case-04/team | 1.80 | 0.990 | 赤印。**finish / switch は比較対象の 2 見積りなのに、switch は minutes と、finish は team と同じ見た目** |
| case-03/invite | case-03/comments | 2.75 | 0.993 | 赤印 |
| case-04/spent | case-04/risk | 3.23 | 0.995 | 青棒 |

事件内の同モチーフペアは 15 組（各事件 3 組）。推理上の対比資料（CASE 04 の `finish`/`switch`、CASE 02 の `launch`/`history`）が見た目で区別できないのが最も影響が大きい。

### 2.2 事件間（grayMad 1.3 未満、上位）

| 資料A | 資料B | grayMad | hist交差 |
| --- | --- | --- | --- |
| case-01/paid | case-04/finish | 0.78 | 0.998 |
| case-03/comments | case-05/rumor | 0.81 | 0.998 |
| case-01/reviews | case-05/rumor | 0.91 | 0.996 |
| case-01/reviews | case-03/comments | 1.04 | 0.996 |
| case-01/retained | case-02/stock | 1.05 | 0.997 |
| case-02/poster | case-03/headline | 1.05 | 0.996 |
| case-02/competitor | case-04/finish | 1.08 | 0.997 |
| case-02/poster | case-04/minutes | 1.10 | 0.997 |
| case-02/stock | case-04/switch | 1.11 | 0.996 |
| case-01/retained | case-03/population | 1.12 | 0.999 |
| case-01/retained | case-05/graphic | 1.12 | 0.996 |
| case-01/retained | case-04/switch | 1.13 | 0.998 |

事件間で同じ並び順の資料は、タイトル文字列以外が同一。事件をまたいで資料を見比べる場面（図鑑、結果画面の証拠一覧、将来の横断検索）では、画像だけで事件を特定する手がかりが無い。

## 3. 種別アイコンの併用提案

`public/assets/props/*.svg` は `visual` enum と同じ 9 語（advert / clipping / label / ledger / news / photo / receipt / report / ticket）が揃っており、`src/data/assets.ts` の `propUrl(PropName)` で型安全に参照できる。`DocumentLabel` では次の対応表（`VISUAL_PROP`）で 1:1 に結び付け、アイコンは `aria-hidden` の装飾、意味はテキスト（`VISUAL_LABEL`）で伝える。

| visual | props ファイル | 表示名 | 使用資料数 |
| --- | --- | --- | --- |
| advert | `props/advert.svg` | 広告 | 3 |
| ledger | `props/ledger.svg` | 台帳 | 4 |
| receipt | `props/receipt.svg` | 決済記録 | 3 |
| report | `props/report.svg` | 報告書 | 7 |
| clipping | `props/clipping.svg` | 切り抜き | 5 |
| news | `props/news.svg` | 記事 | 8 |
| photo | `props/photo.svg` | 写真 | 0 |
| ticket | `props/ticket.svg` | 伝票 | 0 |
| label | `props/label.svg` | ラベル | 0 |

対応表の網羅性（schema enum = `VISUAL_PROP` のキー = `DOCUMENT_VISUALS`）と SVG の実在は `src/components/DocumentLabel.test.tsx` で検証する。

## 4. ラベルによる対応（本 PR で実装）

`DocumentLabel`（`src/components/DocumentLabel.tsx` + `src/components/documentVisuals.ts`（対応表）+ `src/app/screens/document-label.css`）は次を HTML テキストで表示する。

```
[種別アイコン] CASE 01 / 資料 02（trial） / 台帳 / コスト 1
```

- 事件 ID: `formatCaseId('case-01')` → `CASE 01`
- 資料番号: 事件内の並び順（画像内の「DOCUMENT 02」と同じ番号）＋ `id` を括弧で併記
- 種別: `VISUAL_LABEL[visual]`、コスト 0 は「無料」
- 色・余白は `tokens.css` のトークンのみ。文字倍率 200% でも折り返して読める（固定幅なし）
- 読み上げはテキストだけで完結（アイコンは `alt=""` + `aria-hidden`）

### 組み込み方（統合時に実施。MVP-022 が並行変更中のため本 PR では触らない）

- `DocumentGrid.tsx` / `DocumentTile.tsx`: `<img>` の直後に `<DocumentLabel caseId={caseData.id} index={i + 1} documentId={d.id} visual={d.visual} cost={d.cost} />` を置く。`aria-label` を付けている `button` の中では、ラベル文言を `aria-label` 側にも含めるか、`aria-label` を外して中身のテキストに任せる。
- `DocumentDialog.tsx`: 見出し（資料タイトル）の直上に同じラベルを置き、本文 `content` は現状どおり HTML テキストで描画する（画像の本文は罫線のみなので、閲覧本文の視認性はこれで担保される）。
- 結果画面・図鑑などで事件をまたいで資料を並べる箇所では `hideIcon` を使わずアイコン付きで出す（事件間の識別に効く）。

## 5. 画像自体の改善提案（手動レビュー対象・本 PR では未実施）

AGENTS.md「手動レビューしていないアセットはリリース承認外」に従い、画像の再生成・編集はしていない。再生成する場合の要件を記す。

1. **下部モチーフを並び順ではなく `visual` で決める**: 広告=帯、台帳=表、決済=印、報告書=段落、切り抜き=破れ縁、記事=見出し＋段組。`props/*.svg` のモチーフを流用すると図鑑のアイコンと一貫する。
2. **事件ごとに紙色または帯色を変える**: 現状は 5 事件とも `#fff9ef` の紙 + 黒帯。`tokens.css` の `--palette-paper-aged` / `--palette-paper-note` / `--palette-paper-explain` など既存トークンの範囲で事件ごとに紙色を変えるだけで、事件間 grayMad は閾値を超える見込み。
3. **画像内文字を減らす**: 「URAMEKU / ARCHIVE」「DOCUMENT 0N」「資料タイトル」は HTML 側で出せる情報。MVP_SPEC 12 章に沿い、画像は文字なし（または判読不能なダミー罫線のみ）にしてローカライズと文字倍率対応を楽にする。
4. **ゲーム内サイズでの検証**: 65×78px（`.doc-tile img`）で 6 枚を並べて見分けられることを `previews/documents.html` の「ゲーム内サイズ」表示で確認する。
5. 再生成後は `python3 scripts/review_document_thumbnails.py` を再実行し、事件内の同モチーフペアが 0 組、事件間 grayMad の最小値が 8.0 を超えることを確認してからマニフェスト（`assets.manifest.json`）を更新する。

## 6. 再現手順

```sh
python3 scripts/review_document_thumbnails.py                      # Markdown 表を標準出力
python3 scripts/review_document_thumbnails.py --json qa/document-thumbnails.json  # JSON も保存
open previews/documents.html                                       # 目視（ラベル表示切替・ゲーム内サイズ切替あり）
npx vitest run src/components/DocumentLabel.test.tsx
```
