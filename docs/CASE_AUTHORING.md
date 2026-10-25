# ウラメク V2 — 事件制作ガイド

JSON (`data/cases/*.json`) を唯一の正本とする。旧形式の詳細は `archive/game-v1/CASE_AUTHORING.md`。V2では `schemaVersion: 2` と `v2` を指定する。旧フィールドは移行互換用に残せるが、V2の評価とUIで計算・3断片・単一照合を要求しない。

## 制作手順

1. 架空の事件で検証できる事実、出典、期間・対象、未確認事項を定義する。旧事件の数値・分母を都合で変えない。
2. `v2.modes` に decoding / experiment / decision を列挙し必要な操作を設計する。
3. 解読の問い・選択肢・根拠を定義する。複数の妥当な解釈には複数のaccepted選択肢を設ける。acceptedは事実と根拠の整合に対する検証で、人格や価値判断の正解ではない。
4. `v2.graph.paths` に必要な根拠リンク集合を複数経路で定義する。リンクは異なる資料を from / to とし、supports / contradicts / qualifies / sequence の関係を持つ。問いは比較する役割を伝え、資料名で答えを漏らさない。
5. 心理実験は条件・共通選択肢・開示資料・比較の問い・限界を定義する。初回の選択を保存してから対照を示す。両反応・不変でも完了できる。
6. 意思決定は目的・資源・複数選択肢・費用・結果・トレードオフ・追加情報を定義する。保留を設け、少なくとも2つの実行可能な方針を用意する。結果を方針の正誤にしない。
7. 報告の問い・種明かし・留保・再挑戦を用意し、主経路と別経路を予算内で検証する。

## データ契約

`v2` は `revision`（事件改訂）、`modes`、`decoding`、`graph`、`reportPrompt` を持つ。experiment / decision を方式として指定したら対応する設定が必須。解読optionの `evidence` はその選択を裏付けるすべての必要資料。図の経路はリンクの集合で、順番だけを正解にしない。詳細な型は `src/domain/v2Types.ts`、構造・参照検証は `data/schema/case.schema.json` と `src/data/validateCase.ts`。

実験設定は `conditions`、`choices`、`revealDocuments`、`comparisonPrompt`、`explanation`。意思決定設定は `objectives`、`options`（`cost`、`outcome`、`tradeoff`）、`resources`、`revealDocuments`、`updatePrompt`。資料ID・選択肢IDは実在し重複不可。根拠・開示資料を全て開ける予算を用意する。

## レビュー

- [ ] すべて架空であり、人格・能力・バイアス体質を診断しない。
- [ ] 事実誤認と、価値判断・保留・実験反応の違いが明確。
- [ ] 根拠はゲーム内にあり、未確認を虚偽と断定しない。
- [ ] 計算入力なしで成立し、複数資料の解読・比較・判断が必要。
- [ ] 別方針・判断維持・更新・資源不足に終了または回復の経路がある。
- [ ] 既存の事実・分母・正解キーをテストに合わせて改変していない。
- [ ] UIコードに事件IDや答えを埋め込まない。
- [ ] 素材はC-2正本を保ち、未審査を承認済みにしない。
- [ ] `npm run validate:cases` とアセット検証を行い、攻略・レビューを更新する。
