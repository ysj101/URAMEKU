# Grafana Cloud接続の検証

対象: Issue #205。遊び方・CASE00と画面上のCASE01（内部ID `case-06`）。

## 実Cloudでの確認（2026-11-16 JST）

- Faroアプリ `urameku`（613）を `beigebalcony2057` に作成。
  許可Originは `https://ysj101.github.io`。独自の中継は置かない。
- 許可Originの検査用ページをPlaywrightでローカル応答し、実ブラウザ・実SDKから
  合成 `connection` ジャーニーを送信。collectorは202を返した。
- Tempoで開始 `bc0804f36401b9b9aa8b07179728765a` と
  完了 `e03eef0cb73d507c715f27dd5a2c2532` を取得し、JourneyGapの属性保持を確認。
- 取得した属性をOTLP形式へ戻して純粋な解析APIに渡し、2イベント・開始1・完了1・順序違反0。
  定常集計の自動化やダッシュボード作成はこの検証に含めない。
- 保持期間は30日。画面も30日に変更し、旧14日のローカルRelayは撤去する。
- セッションなしの元SDKは実受信口で400になった。修正後はJourneyGapの既存IDを
  Faroのmeta.session.idとx-faro-session-idにも渡す。別IDや自動RUMは追加しない。

## アプリでの受入検証

ローカルFaro受信サーバーを使い、実アプリの送信を解析する。
同意前・拒否・撤回、CASE00/CASE01の完了、入力の非送信、対象外事件、保存復元を確認する。
自動検証と本番配信の最終結果はPRとIssue #205に記録する。

画面文言はyomiyasuのlint・差分・最終稿照合を実行。14→30の数値変更は
ユーザーの選択とCloudの実設定に基づく。資料との自動照合は未実施。
`yomiyasu-check: executed via=verify run=20261115T220323Z-39e23ad9 attempt=1 final=sha256:f3e10453b9c0 mode=rewrite reader=general checks=lint,diff meaning_risk=1 replay=skipped`

## 制約

送信はbest effort。長時間利用・休止後のFaroセッション自動更新は行わないため、
Cloudがsession-invalidとしたバッチは欠落し、新しい同意セッションになるまで届かない場合がある。
アート・権利・本番品質の承認は自動検証で代替しない。
通常E2Eの既知の不安定性は https://github.com/ysj101/URAMEKU/issues/202 で追跡する。

---

以下は旧OTLP/Relay組み込み時の履歴。現在の受信経路・保持期間には適用しない。

# JourneyGapの組み込み検証

Issue: https://github.com/ysj101/URAMEKU/issues/201

## 対象

遊び方・CASE00と画面上のCASE01「平均おこづかい3000円」（内部ID `case-06`）。
JourneyGapは `96c01aaeccd022c556f64fff5a4777604446734a` から作成した実パッケージを使用。
Node 26.12.1、pnpm 10.30.2で生成し、Web/Core/RelayのライセンスとSHA256を同梱した。
本番送信は既定で無効。本番受信先・実利用者のデータは使用していない。

## 実行した検証

- `npm ci --ignore-scripts`: クリーンインストール成功。未公開SDKをnpmレジストリから取得する必要はない。
- `npm test -- --reporter=dot`: 90ファイル、873件成功、既存2件スキップ。
- 通常E2E（Chromium PC・モバイル）: 123件成功、既存4件スキップ、モバイルのキーボード操作1件失敗。下記の切り分け結果を参照。
- `npm run test:telemetry`: Chromiumで3件成功。ビルド済みアプリから実Web SDKのOTLP JSONを実Relayに送り、認証付き集計APIで結果を検証した。
- `npm run lint`: エラーなし、既存のFast Refresh警告3件。
- `npm run typecheck`、`npm run format:check`、`npm run lint:wording`、`npm run lint:ui`: 成功。文言・UIのbaseline追加なし。
- `python3 scripts/validate_assets.py`: 583資産、7事件、問題なし。
- `qa/coverage.json` を確認。本番の原画・権利・実機β等の未完了5項目は承認済みに変更していない。
- `npm audit --omit=dev`: 脆弱性0件。全依存の監査は中程度7件で、mainのlockfileだけを別ディレクトリで監査した結果と同じ開発用依存（typescript-eslint系列・minimatch）。今回追加した依存に起因するものはなかった。

## 実ブラウザで確かめたこと

1. 同意前と拒否後にはPOSTがない。許可後にCASE00の6ステップが順に届き、開始・完了が1件ずつになる。
2. CASE00から画面上のCASE01に進み、新しい資料の閲覧と報告提出が別々のジャーニーで完了する。報告の完了は正答・調査完了を意味しない。
3. 任意の文章に検査用文字列を入力しても、OTLP本文にその文字列やCASE00の選択肢本文が含まれない。
4. 提出済み画面のリロードで開始・完了が増えない。対象外の `case-01` を開いてもCASE01の開始が増えない。
5. 送信周期前の撤回で送信待ちイベントが消える。他タブでの撤回が反映される。
6. 「この端末の記録をすべて削除」でホスト・SDKの同意とタブIDが消え、停止状態になる。
7. 実際にOTLPリクエストを失敗させても、報告提出と再読み込み後の保存復元が動く。
8. 同意UIを幅320px・文字200%で表示し、横スクロールがないことを機械検証し、スクリーンショットでも確認した。

単体テストではStrictMode・戻る操作・再挑戦の重複抑制、同意後の過去進捗の非補完、
読み込み中の撤回、保存領域の例外、SDKの初期化失敗、WebとRelayの定義一致も検証した。

## 検証中に修正した不具合

- URLで他事件を指定した際、ゲーム状態との同期前に既定のCASE01を誤って観測していた。URLと事件IDが一致するまで観測しないようにした。
- 全件削除の実際の経路がlocalStorageだけの削除だった。計測の即時撤回とsessionStorageの関連キー削除も行う経路へ統一した。
- 撤回処理で保存失敗が起きると停止処理まで到達しない可能性を取り除き、SDK読込中の撤回もメモリで保持した。

## 文言の確認

対象は追加した計測UI、および設定・フッターの説明。読み手は専門知識のない人。
日本語の主張・条件を目視で点検し、yomiyasuのlint・diff・最終稿照合を実行した。
抽出した画面文言は自然な説明として維持した。文末反復の候補はボタン・状態表示を
まとめて抽出した影響があり、「送信先：」は動的な送信先のラベルなので残した。
資料との自動照合は未実施。実装と説明の整合はコードとブラウザで点検した。

`yomiyasu-check: executed via=verify run=20261115T202736Z-e2caebf2 attempt=1 final=sha256:d0cf32a2ce76 mode=rewrite reader=general checks=lint,diff meaning_risk=0 replay=skipped`

## 残る制約

公開受信先のTLS・CORS・CSP・レート制限・アクセスログ・運営者と問い合わせ先は、
配備先が決まってから実環境で確認する。保持期間はUI・ローカルRelayとも14日。
自動ナビゲーションの対象外画面はunknown分類で観測されるが、他事件のジャーニーは送らない。
SDKの送信はbest effortで、完了の欠落を離脱理由・個人特性と断定できない。
アート・権利・本番運用品質の承認を今回の自動検証で代替しない。


## 既存の通常E2Eの不安定性

通常E2Eの失敗は資料ダイアログを連続して開閉するモバイルのキーボードテスト。
導入ブランチでは個別3回で2成功・1失敗。変更前のmain `49ba130` を別のworktreeで
同じNode・依存を使って検証し、5回は成功、その後10回で8成功・2失敗となった。
いずれも `e2e/v2-cases.spec.ts:261` のダイアログ表示待ちで失敗した。
原因は未確定で、今回の変更に由来するとは断定しない。再現手順と追跡は
https://github.com/ysj101/URAMEKU/issues/202 に記録した。
SDKの対象外事件にはゲームAPIのラッパーを渡さず、今回の影響範囲も絞った。
