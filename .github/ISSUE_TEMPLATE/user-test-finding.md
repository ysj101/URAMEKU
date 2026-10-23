---
name: 利用者テストの所見（改善）
about: 利用者テスト（MVP-044）で見つかった詰まり・誤解・不快点から改善 Issue を起票する
title: 'UT｜<画面>/<操作>: <一言で現象>'
labels: user-test
assignees: ''
---

<!--
記入ルール（docs/qa/user-test-plan.md 1 章・6 章）:
- 主語は「画面」「文言」「操作」。参加者の性格・能力・理解の速さを書かない。
- 氏名・属性を書かない。参加者番号（P01 等）のみ。
- 事実（観察・引用）と推測（原因の仮説）を分ける。
-->

## 現象（事実のみ）

- 画面: `<home / cases / tutorial / intro / desk / document / board / calc / article / result / encyclopedia / settings>`
- 操作: `<open_document / pin / link_select / calc_input / fragment_order / publish / reset_case / ...>`
- ケース: `<tutorial / case-01 / case-02 / ...>`
- 何が起きたか:
- 参加者の発言（引用）:

## 再現した参加者

- 参加者番号と時刻: `P01 16:20`, `P03 14:05`（`qa/user-tests/PNN.json` の `stuck_points[]` を参照）
- 端末: `<smartphone / tablet / pc>`（複数可）
- 再現人数: `<N> / <総人数>`

## 分類

- 種別: `<rule_unclear / ui_unclear / content_unclear / reasoning_hard / bug>`
- 重大度: `<blocks_completion / misleads / unpleasant / preference>`

| 重大度 | 定義 |
| --- | --- |
| `blocks_completion` | 完走を妨げる。先に進めない、または助け舟なしでは進めなかった |
| `misleads` | 誤解を生む。進めるがルール・事件の内容を誤って理解させる |
| `unpleasant` | 不快。いらだち・疲れ・読みにくさを生むが進行と理解は妨げない |
| `preference` | 好み。個人の好みの範囲 |

## 原因の仮説（推測であることを明記）

-

## 改善案

- 変更する画面・文言・データ:
- 変えてはいけないもの: 正解キー（`required_evidence` / `required_link` / `analysis_tasks` / `correct_fragments`）はテストを通すために変更しない（`AGENTS.md`）。推理の難しさ自体（`reasoning_hard`）は欠陥ではない。
- 文言を変える場合は `npm run lint:content` を通す。

## 確認方法

- [ ] 修正後、新しい参加者で同じ手順（`docs/qa/user-test-plan.md` 3 章）を再実施し、同じ箇所で再現しないこと
- [ ] 自動テスト／再現手順:

## 関連

- 集計: `npm run summarize:user-tests` の出力（該当行を貼る）
- 関連 Issue / PR:
