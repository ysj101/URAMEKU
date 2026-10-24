# 架空表記 / 学術概念レビュー（MVP-017）

- 実施日: 2026-10-24
- 対象コミット: `mvp-003-separate-domain` 基点のブランチ `mvp-017`
- 対象範囲: `data/ui/ja.json`、`data/encyclopedia/ja.json`、`data/achievements.json`、`data/cases/*.json`（閲読のみ・編集なし）、`src/components/*.tsx`、`src/screens/*.tsx`、`src/app/App.tsx`（閲読のみ）、`docs/`・`public/`・`README.md`（第三者名の grep）
- 根拠文書: `docs/CONTENT_POLICY.md`、`docs/LEGAL_ASSET_REVIEW.md`、`docs/MVP_SPEC.md` 2 章・5.6 章・5.7 章・13 章、`AGENTS.md`
- 補助ツール: `npm run lint:content`（`scripts/lint_content.mjs`。本レビューで新設）

## 1. 観点

| # | 観点 | 根拠 | 判定基準 |
|---|---|---|---|
| A | 心理診断の禁止 | SPEC 2 章「人格・能力・認知特性の診断には使わない」、5.6「バイアス体質の判定スコアを計算しない」、5.7「あなたは○○バイアスが強い、と断定しない」、13 章「誤答で人格・能力・固定的特性を断定しない」、CONTENT_POLICY「ユーザーの能力や人格を評価しない」 | UI 文言・図鑑・実績・結果画面に「あなたは○○タイプ」「〜な性格」「判断力が低い」等、プレイヤー個人を対象にした断定が無いこと。評価の主語は「記事・選択」であること |
| B | 実在企業・商品・人物・メディアへの誤認 | SPEC 6 章「企業・人物・集計値は架空」、13 章「すべてのケースで架空データと明示される」、CONTENT_POLICY「5件はすべて架空」 | ケース本文・図鑑・ブランド文言に実在名・酷似名が無いこと。各ケースに架空表記（`disclaimer`）があり、UI に表示されていること |
| C | 学術概念の記述の正確さ・慎重さ | SPEC 2 章「バイアス名は理解の補助」、CONTENT_POLICY「少数の選択で個人の特性を確定しない」 | 図鑑 5 項目の `summary` と各ケースの `debrief` が「〜することがある」「〜しうる」等の確率的表現で、誤った説明を含まないこと。法的評価を断定しないこと |
| D | 第三者の視覚的インスピレーション元の非開示 | `AGENTS.md`「User-facing specs must not disclose or name third-party visual inspiration sources」、`docs/ART_BIBLE.md`「公開用仕様書に他社作品の名前・URLを記さない」 | `docs/`・`public/`・`README.md` のテキストに具体的な作品名・ブランド名・画風の参照元が書かれていないこと |

## 2. 所見

### A. 心理診断の禁止 — 問題なし

- `data/ui/ja.json`: 評価語は「根拠が整いました」「証拠を再確認しましょう」で、主語は証拠・記事。`notices.notDiagnosis` に「少数の選択から心理特性を診断するものではありません。」を保持。
- `data/encyclopedia/ja.json`: 5 項目すべてに `disclaimer`「状況内の判断を説明する概念であり、個人の心理特性を断定するものではありません。」がある。
- `data/achievements.json`: 5 件とも行為ベース（「最初の資料をピン留めする」等）。能力・性格を表す称号なし。
- `src/screens/ResultScreen.tsx`: 見出しは「編集部の評価」「掲載承認 / 追加調査が必要」「記事を差し戻しました」で、評価対象は記事。失敗時の文言は「すべての必要証拠を採用し…必要があります」と次の行動を示す形で、プレイヤー特性に触れない。「編集後記：{bias}」は事件の論点名であり、個人への帰属表現はない。
- `src/screens/InvestigationScreen.tsx` / `ArticleScreen.tsx` / `src/components/*.tsx`: 手順説明のみ。該当表現なし。
- `src/app/App.tsx`（閲読のみ）: 「企業・統計・人物は架空。判断傾向の心理診断は行いません。」の注記あり。
- `npm run lint:content`: `data/**/*.json` 22 ファイル + `src/**/*.tsx`（テスト除く）で error 0 / warn 0。

### B. 実在企業・商品・人物・メディアへの誤認 — 文言は問題なし、表示に申し送りあり

- `data/cases/case-01〜05.json` の全文字列を閲読。企業・店舗・サービスは「靴店」「新サービス」「配信システム」「競合店」「別の調査会社」など無名化されており、実在名・酷似名・実在人物名なし。「SNS」「オンライン投票」「公式ファンコミュニティ」も一般名詞。
- 5 ケースすべてに `disclaimer: "登場人物・企業・統計・広告はすべて架空です。"` がある（スキーマで必須）。
- `public/` の SVG 内テキスト（タグライン「証拠から解き明かす、行動経済学の推理ゲーム」、「URAMEKU / ARCHIVE」等）に実在名なし。
- **未対応（UI 側）**: ケースの `disclaimer` フィールドと `ui.notices.fiction` / `ui.notices.notDiagnosis` は、現在の `src/` のどの画面からも参照されていない（`grep -rn disclaimer src` は `types.ts` と test fixture のみ）。架空表記はホーム画面の `App.tsx` 内フッター注記 1 か所に依存しており、SPEC 13 章「すべてのケースで架空データと明示される」をケース単位では満たしていない。→ 申し送り（§4）。

### C. 学術概念の記述 — 軽微修正 1 件

| 項目 | summary | 判定 |
|---|---|---|
| フレーミング効果 | 表現形式の違いが選択や評価に影響することがある。 | 可（確率的表現） |
| アンカリング効果 | 最初に提示された数値が → **数値や情報が**、その後の判断の基準として働くことがある。 | **修正**。アンカーは数値に限らないため「数値や情報」に広げた。ケース 02 は数値アンカーなので整合は保たれる |
| 社会的証明 | 他者の行動や評価が自分の判断の手がかりになりうる。 | 可 |
| サンクコスト効果 | 回収不能な過去の費用が、将来の判断に影響することがある。 | 可 |
| グラフの尺度と見え方 | 目盛りと基準線の設定により、変化の印象が異なる場合がある。 | 可 |

- ケース `debrief`（閲読のみ）: いずれも「〜しうる」「〜可能性がある」「〜断定できない」の形。ケース 02 の takeaway「法的評価は追加事実と法域の確認が必要」、ケース 04 の「このゲームの数値は仮定」は適切。ケース 03 の explanation「社会的証明の表現は意思決定に影響しうる」も可。誤った説明は見当たらない。
- ケース `bias` 欄（結果画面「編集後記：」に表示）は「分母の省略とフレーミング」「スケール効果とフレーミング」など事件の論点名で、学術用語の厳密名ではない。図鑑タイトルとの対応は MVP-027 の図鑑アンロック表示時に見出しとして混同されないよう注意（申し送り、修正不要）。

### D. 第三者の視覚的インスピレーション元 — 問題なし

- `README.md`、`index.html`、`docs/*.md`、`public/`（SVG・webmanifest）、`design/source-character-manifest.json`、`qa/`、`assets.manifest.json` を、ゲーム作品名・ゲーム会社名・SNS/プラットフォーム名・画像生成/素材サイト名・著名研究者名・「参考にした / インスピレーション / 画風 / オマージュ」で grep。該当なし。
- 検出された固有名はいずれも技術・権利上の記述で、視覚的インスピレーション元ではない: `docs/LEGAL_ASSET_REVIEW.md` の「Noto フォント」（フォント同梱可否の注記）、`docs/RELEASE_SOURCES.md` の App Store Connect 仕様 URL（ストア提出要件）。
- `docs/ART_BIBLE.md` は正本を `design/reference/c2-canonical-board.png`（自社資産）と定義し、他社作品名は書いていない。
- 内部文書の扱い: `docs/ART_BIBLE.md`・`docs/LEGAL_ASSET_REVIEW.md`・`design/` は開発者向け内部文書であり AGENTS.md の「user-facing specs」には当たらないが、本リポジトリは公開可能性があるため、**内部文書であっても具体的な第三者作品名・URL は書かない**方針を `docs/CONTENT_POLICY.md` に明記した。

## 3. 修正したもの

| ファイル | 変更 |
|---|---|
| `data/encyclopedia/ja.json` | アンカリング効果の summary「最初に提示された数値が」→「最初に提示された数値や情報が」 |
| `docs/CONTENT_POLICY.md` | 「文言チェックリスト」「第三者名の扱い」「機械チェック」を追記 |
| `scripts/lint_content.mjs`（新規） | 禁止・注意語の簡易チェッカー。`data/**/*.json` と `src/**/*.tsx`（`*.test.tsx` 除く）を走査。否定文は許容パターンで除外。`--strict` で warn も失敗扱い |
| `package.json` | `lint:content` スクリプトを追加（`check` には含めない） |

ケース JSON・`App.tsx`・`useGame.ts`・`global.css`・`src/domain` は変更していない。

## 4. 申し送り

| 内容 | 担当 Issue |
|---|---|
| 結果画面・調査画面にケースの `disclaimer`（「登場人物・企業・統計・広告はすべて架空です。」）を表示する。少なくとも結果画面の解説ブロック（「編集後記」）直下に出す。あわせて `ui.notices.fiction` / `ui.notices.notDiagnosis` を表示箇所に接続する | #26 MVP-026（結果・解説・再挑戦UI）、調査画面側は #22 MVP-022 |
| 図鑑画面では各項目の `disclaimer` を summary と同じ画面に表示する。ケースの `bias`（論点名）と図鑑 `title`（概念名）を同じ見出しとして混在させない | #27 MVP-027（図鑑・事件手帳の基本画面） |
| ケース本文のレビュー結果（実在名なし・debrief 表現は適切）。数値・答えの検算は本レビューの対象外 | #14 MVP-014、#15 MVP-015（情報共有のみ） |
| `lint:content` を CI（`check` または独立ジョブ）に組み込むかの判断。現状は手動実行 | #5 MVP-005（GitHub Actions） |
| 新規ケース追加時は `docs/CONTENT_POLICY.md` の文言チェックリストと `npm run lint:content` を通す | `docs/CASE_AUTHORING.md` 保守者 |

## 5. 検証手順

```bash
npm run lint:content   # errors=0 を確認
npm run check          # lint / typecheck / format:check / test
```
