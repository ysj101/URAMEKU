# case-02〜05 図解解説

各事件の解説公開時に、行動経済学や判断の仕組みを説明する画像を表示する。case-01と同じ紙・インク・赤鉛筆・青緑の資料表現を用い、人物は新たに生成していない。画像は組み込みimagegenで生成し、指示全文をcase-02〜05-visual-explanation-prompt.txtにそれぞれ保存した。

## 内容と根拠

| 事件 | 図解の中心 | 資料から確かめたこと | 決めつけないこと |
| --- | --- | --- | --- |
| case-02 | アンカリング。先に見た価格が比較の基準になることがある | 発売時8,000円、最近の大半4,200円、当日4,000円。最近との差は200円、約4.8% | 買う・見送るのどちらかを唯一の正解にしない。一回の反応で表示の影響を確定しない |
| case-03 | 社会的証明。多数派の情報が判断の手がかりになることがある | 回答者200人中160人。公式ファンコミュニティだけで募集し自由参加。利用者は約20,000人 | 全利用者の80%と広げない。別調査の54%を唯一の真値にしない |
| case-04 | サンクコスト効果。取り戻せない支出が継続判断に影響することがある | 過去300万円はどの方針でも返金なし。今後の費用は継続150万円、代替80万円 | 来期便益の最大100万円・120万円は見積り。技術・移行リスクを残し、変更だけを正解にしない |
| case-05 | 軸の範囲による視覚的なフレーミング | 同じ40%→50%を縦軸35〜55%と0〜100%で比較。10ポイント差と相対25%増を区別 | 軸の強調を理由に差を消さない。全利用者への広がりや原因は未確認 |

一般的な仕組みを、各架空事件を読むための教材として説明している。プレイヤーの性格や能力の診断、作中で効果が測定・実証されたという主張には使用していない。

### 理論の確認

- アンカリング：[Tversky & Kahneman (1974), Judgment under Uncertainty: Heuristics and Biases](https://doi.org/10.1126/science.185.4157.1124)。数字を起点に判断する仕組みの説明を確認した。
- 社会的な影響：[Muchnik, Aral & Taylor (2013), Social influence bias: a randomized experiment](https://pubmed.ncbi.nlm.nih.gov/23929980/)。他者の評価を知ることが判断に影響しうる説明を確認した。作中の調査の代表性はゲーム内の資料から判断する。
- サンクコスト：[Arkes & Blumer (1985), The psychology of sunk cost](https://www.sciencedirect.com/science/article/pii/0749597885900494)。過去の費用・努力・時間が継続判断に影響する説明を確認した。
- 軸の範囲：[Correll, Bertini & Franconeri (2020), Truncating the Y-Axis: Threat or Menace?](https://www.tableau.com/research/publications/truncating-y-axis-threat-or-menace)。軸の省略と見た目の効果の関係を確認した。折れ線グラフの軸を0以外から始める行為自体を一律に誤りとはしていない。

## 表示とデータ

解説文・代替テキスト・画像参照・資料IDは各case JSONのdebrief.visualGuideで管理する。case-01用の人数表示を他事件に流用せず、case-02〜05はpanelsで価格・回答者・費用・グラフの事実を記述する。詳細は「図の内容と根拠を読む」から開ける。画像は別タブで拡大でき、読めない場合もHTMLで内容と根拠を確認できる。

画像の日本語と数値は目視確認した。case-05では、両グラフの目盛り・40%と50%の点の位置を照合した。画像内の全数値はゲーム内資料に基づく。既存の資料本文・選択肢・正解キー・解説文は変更していない。

人間による美術・権利の承認は未実施。全画像のassets.manifest.jsonのart_reviewはREQUIREDで、リリース承認済みではない。qa/coverage.jsonのartAndRightsApprovalはpendingのまま確認した。

## 変えたところ

- case-02〜05に、仕組みを説明する画像と短い解説を追加した。
- 資料から言えることと未確認のことを分け、詳しい根拠は開閉できるようにした。
- 共通表示・型・スキーマ・実行時検証を拡張し、人数以外の解説も表示できるようにした。

### 確認の記録

- 書き手・読み手・場面: 書き手: 決めていない／読み手: 専門知識のない人（指定）／場面: ゲームの解説（指定）
- 実行した検査: lint、diff、資料との照合、最終稿の照合
- 実行しなかった検査: なし
- 硬化の検査: 候補なし
- 勢いの検査: 候補なし
- 見直し候補: 原文 0件 → 最終稿 0件（件数は点数ではない。増減は読みやすさの良し悪しを示さない）
- yomiyasu-check: executed via=verify run=20261028T232133Z-b2bd1bc8 attempt=1 final=sha256:435ea64fb5ed mode=rewrite reader=general checks=lint,diff meaning_risk=0 replay=skipped

新規解説の下書きを機械で確認した後、意味・条件・数値を保って通読した。採用した下書きは自然な表現のため変更せず、同じ文章でrunとverifyを実行した。qa/wording-baseline.jsonへの追加はない。

## 検証

- 単体テスト：80ファイル770件通過。
- ブラウザ検証：全5事件を実際のUIで調査・報告・解説公開まで操作。PCと390px幅で計10件通過。画像読み込み、別タブ拡大のリンク、内容と根拠の開閉、問ごとの解説の開閉、常時表示の注記、横はみ出しなしを確認。
- 各画面のスクリーンショットはqa/screenshots/visual-explanations/に保存して目視確認した。このフォルダーは既存設定でGit管理外。
- build、typecheck、validate:cases、check:assets、lint:wording：通過。
- python3 scripts/validate_assets.py：543素材・5事件、PASS。
- ESLint：.claude/worktrees/の別作業ツリーを除いた本体でエラー0。既存のFast Refresh警告4件。
- Prettier：Git管理対象と今回の追加ファイルを既存のignore設定で検査し通過。
- npm run checkは、ESLintが.claude/worktrees/内の別作業の生成済みファイルまで読み込むため途中停止。同じ本体の各検査を個別に実施した。検査を通すための設定変更は行っていない。

PRは先行の#139を基点とし、先に作成したcase-01と今回の4事件を共通表示ごと含める。
