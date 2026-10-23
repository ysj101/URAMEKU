# 利用者テスト記録（`qa/user-tests/`）

- 1 セッション = 1 ファイル `PNN.json`（例: `P01.json`）。`session-template.json` をコピーして埋める。
- 集計: `npm run summarize:user-tests`（`scripts/summarize_user_tests.mjs`）。完走率・平均所要時間・楽しさ・理解度・詰まり箇所の頻度・重大度を Markdown 表で出力する。
- `examples/` はフォーマット確認用の**架空のサンプル**であり、集計対象外（スクリプトはこのディレクトリ直下の `*.json` のみ読む。`session-template.json` も除外）。
- 計画・手順: `docs/qa/user-test-plan.md`。観察者シート: `docs/qa/user-test-session-template.md`。同意文: `docs/qa/user-test-consent.md`。
- **現状: 実施済みセッション 0 件（0 / 5 人）。**

## 記録してはいけないこと

`AGENTS.md` / `docs/CONTENT_POLICY.md` に従う。

- 氏名・所属・連絡先・年齢・性別。参加者番号のみ。
- 参加者の性格・能力・認知特性・「○○バイアス」の有無などの評価。評価の主語は「画面」「文言」「操作」であり、参加者ではない。
- 録画・録音・スクリーンショット（参加者の端末のもの）。

集計スクリプトは自由記述に評価語（性格・能力・頭が悪い 等）が含まれていないかを簡易に検査し、見つかれば終了コード 1 で止まる。機械検査は補助であり、観察者の自制を置き換えない。

## フィールド一覧

| フィールド | 型 | 内容 |
| --- | --- | --- |
| `schema_version` | number | `1` 固定 |
| `participant` | string | `P01` 形式の参加者番号。氏名は書かない |
| `date` | string | `YYYY-MM-DD` |
| `observer` | string | 観察者コード（`OBS-A` 等。氏名ではない） |
| `build.commit` | string | テストしたビルドのコミット SHA |
| `build.url` | string | 開いた URL（任意） |
| `consent.verbal` | boolean | 口頭同意を得たか（必須 `true`） |
| `consent.time` | string | 同意を得た時刻 `HH:MM` |
| `device.type` | enum | `smartphone` / `tablet` / `pc` |
| `device.os`, `device.browser` | string | 分かる範囲で |
| `device.viewport_width` | number \| null | 画面幅 px |
| `device.input` | enum | `touch` / `mouse` / `keyboard` |
| `session.total_minutes` | number | 導入からインタビュー終了まで |
| `session.ended_reason` | enum | `finished` / `time_up` / `participant_stopped` / `bug` |
| `ran_without_verbal_help` | boolean | 観察者の口頭補足なしで CASE 01 を進められたか（助け舟 0 回） |
| `cases[]` | array | ケースごとの結果（下表） |
| `stuck_points[]` | array | 詰まり箇所（下表） |
| `fun` | 1〜5 | 楽しさの自己申告（1 = 退屈、5 = とても楽しい） |
| `fun_comment` | string | 面白かった／退屈だった瞬間（引用） |
| `understanding.explained_in_own_words` | enum | `yes` / `partial` / `no`。事件の論点を自分の言葉で説明できたか |
| `understanding.quote` | string | 参加者の説明（引用） |
| `after_mistake.had_next_idea` | enum | `yes` / `partial` / `no` / `not_applicable`（不掲載が一度もなかった場合） |
| `after_mistake.note` | string | 「次はどうしますか」への答え（引用） |
| `readability.paper_decoration_issue` | boolean | 紙の装飾が可読性を妨げた場面があったか |
| `readability.note` | string | 画面・資料・内容 |
| `interview` | object | 事後インタビュー Q1〜Q8 の答え（引用）。キーは `q1`〜`q8` |
| `free_text` | string | 参加者の自由記述・自由発言 |
| `observer_notes` | string | 観察者の所感。ゲーム側の改善候補と手順の反省のみ |

### `cases[]`

| フィールド | 型 | 内容 |
| --- | --- | --- |
| `case_id` | enum | `tutorial` / `case-01` / `case-02` / `case-03` / `case-04` / `case-05` |
| `started_at`, `ended_at` | string | セッション開始を `00:00` とした経過時刻 `MM:SS` |
| `minutes` | number | 所要分 |
| `completed` | enum | `yes` / `no` / `skipped` |
| `failed_publishes` | number | 不掲載になった回数 |
| `reset_count` | number | 事件リセットの回数 |
| `documents_opened` | number \| null | 開いた資料数 |
| `help_given[]` | array | 助け舟。`{ "time": "MM:SS", "condition": "stuck_3min" \| "dead_end_2min" \| "bug" \| "participant_request", "said": "言った内容" }` |

### `stuck_points[]`

| フィールド | 型 | 内容 |
| --- | --- | --- |
| `time` | string | `MM:SS` |
| `case_id` | enum | `cases[].case_id` と同じ |
| `screen` | enum | 下の画面名一覧から |
| `action` | string | 操作名（下の例から。該当がなければ短い英小文字で） |
| `observation` | string | 何が起きたか。事実と引用のみ |
| `kind` | enum | `rule_unclear`（ルールが分からない） / `ui_unclear`（操作・表示が分からない） / `content_unclear`（事件の文章・数字が読み取れない） / `reasoning_hard`（推理が難しいが納得できる） / `bug` |
| `severity` | enum | `blocks_completion` / `misleads` / `unpleasant` / `preference`（定義は `docs/qa/user-test-plan.md` 6 章） |
| `resolved_by` | enum | `self` / `hint`（画面内のヒント・ガイド） / `observer`（助け舟） / `gave_up` |

### 画面名（`screen`）

`src/app/navigation.ts` のルートと `docs/MVP_SPEC.md` 8 章に対応する。

| `screen` | 画面 |
| --- | --- |
| `home` | タイトル `#/` |
| `cases` | 事件一覧 `#/cases` |
| `tutorial` | チュートリアル `#/tutorial` |
| `intro` | 事件導入（予算と初期資料の説明） |
| `desk` | 調査デスク（資料カード一覧・予算） |
| `document` | 資料閲覧モーダル |
| `board` | 証拠ボード（ピン留め・照合） |
| `calc` | 数値の検証メモ |
| `article` | 記事編集（断片の並べ替え） |
| `result` | 採点・解説 |
| `encyclopedia` | 図鑑 `#/encyclopedia` |
| `settings` | 設定 `#/settings` |

### 操作名の例（`action`）

`open_document`, `pin`, `unpin`, `link_select`, `link_confirm`, `calc_input`, `fragment_select`, `fragment_order`, `publish`, `reset_case`, `navigate`, `read`, `scroll`, `zoom`, `other`
