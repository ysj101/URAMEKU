# ウラメク C-2 UI改修・検証記録

2026-10-24。対象チェックアウト: `/Users/ysj/orca/workspaces/URAMEKU/prowfish`。

## 正本との比較と改善

`design/reference/c2-canonical-board.png` と `docs/ART_BIBLE.md` を確認し、修正前のPC・スマホ画面を撮影してから改修した。

| 修正前の差分 | 改修内容 |
| --- | --- |
| 格子状の背景が画面全体に強く出ていた | 既存の紙テクスチャを再利用。読む領域は静かな白紙にした |
| タイトルが大きな文字と小さな1人の立ち絵だけだった | 新聞の題字・二重罫・赤い下線・切り抜き見出しと、4人の既存原画を組み合わせた集合へ変更 |
| 事件選択が状態アイコン中心の均一な行だった | 5事件の既存表紙と台帳・広告・記事・写真・報告書の小物を使用。下紙の傾きと重なりを追加 |
| 調査資料の画像が小さく、全部が同じ太枠だった | 画像を拡大。広告は赤刷り、帳票は青い綴じ、記事は二重罫、メモは破線と付箋色、写真は余白のある台紙にした |
| 資料詳細が一律だった | 資料種別とIDのHTMLラベル、種別に合った罫線、静かな本文領域、2Dで紙をめくる演出を追加 |
| ボードと資料一覧の紙の表現が分離していた | 紙の質感、画鋲、付箋、微細な傾きと赤い糸を統一。選択A/Bと資料名で関係性を読める構造を維持 |

色は既存トークンの紙・墨・赤・青を使用。和文見出しは太いゴシック体、本文は既存の読みやすいシステム書体。重要な数値・資料本文は引き続きHTMLテキストで表示し、未調査資料の内容は事前に開示しない。

キャラクター画像の生成・加工・置換はしていない。4人の既存ポーズをそのまま拡大配置。新規の製品向け装飾アセットは追加せず、既存の表紙・小物・テクスチャで構成した。

## 修正前後のスクリーンショット

PC: 1440×1000 / スマホ: 390×844。全ページ画像、ボードは要素画像。資料詳細の画像はモーダルを開いた状態の全ページ画像のため、暗幕は表示中のビューポート範囲に描画される。

| 画面 | PC 修正前 | PC 修正後 | スマホ 修正前 | スマホ 修正後 |
| --- | --- | --- | --- | --- |
| タイトル | [画像](../../qa/ui-c2/before/desktop-home.png) | [画像](../../qa/ui-c2/after/desktop-home.png) | [画像](../../qa/ui-c2/before/mobile-home.png) | [画像](../../qa/ui-c2/after/mobile-home.png) |
| 事件選択 | [画像](../../qa/ui-c2/before/desktop-cases.png) | [画像](../../qa/ui-c2/after/desktop-cases.png) | [画像](../../qa/ui-c2/before/mobile-cases.png) | [画像](../../qa/ui-c2/after/mobile-cases.png) |
| 調査デスク | [画像](../../qa/ui-c2/before/desktop-desk.png) | [画像](../../qa/ui-c2/after/desktop-desk.png) | [画像](../../qa/ui-c2/before/mobile-desk.png) | [画像](../../qa/ui-c2/after/mobile-desk.png) |
| 資料詳細 | [画像](../../qa/ui-c2/before/desktop-document.png) | [画像](../../qa/ui-c2/after/desktop-document.png) | [画像](../../qa/ui-c2/before/mobile-document.png) | [画像](../../qa/ui-c2/after/mobile-document.png) |
| 証拠ボード | [画像](../../qa/ui-c2/before/desktop-board.png) | [画像](../../qa/ui-c2/after/desktop-board.png) | [画像](../../qa/ui-c2/before/mobile-board.png) | [画像](../../qa/ui-c2/after/mobile-board.png) |

PCの開始ボタンと本文が離れすぎていた初回実装、PC・スマホの見出しの不自然な折り返し、200%文字拡大時の資料IDのはみ出しを、画像とDOM計測を見て再修正した。

## 検証結果

- `npm run check`: Lint、アプリ/Node用TypeScript、整形、64ファイル693テスト成功。既存のFast Refresh警告3件（EncyclopediaCard / NumericField）は残存、Lintエラーは0件。
- `npm run build`: TypeScript検査・Vite本番ビルド成功。
- `npm run test:e2e -- --project=chromium --project=mobile-chromium --workers=1`: PC・スマホ30件成功。正解/不正解、予算、採用、資料の閉じ方、保存・再開、遷移を検証。
- モバイル資料ダイアログ履歴: 4経路×3回、12件成功。
- 初回の2ワーカーE2Eでは、モバイルの採用直後の履歴検証が1件失敗（29/30）。同じ機能コードのまま単独反復12/12、全件再実行30/30が通った。間欠的な履歴タイミング問題の可能性が残るため、再発時の調査対象とする。履歴やセーブのロジックは今回変更していない。
- 320 / 375 / 390 / 430 / 768 / 1440px: ホーム、事件一覧、全5事件で横はみ出しなし。表示中の操作要素は44px以上。
- 各幅でEnterによる資料表示、ダイアログ内へのフォーカス、Escで閉じて元資料へフォーカス復帰、OS reduced-motionで演出停止を確認。上記と合わせて54チェック成功。計測結果: `qa/ui-c2/viewport-results.json`。
- アプリ内reduced-motion設定でも、追加演出とホバー移動を停止するCSSを適用。
- 200%文字拡大: 320 / 390 / 1440pxのホーム・事件一覧・調査デスクで横はみ出しなし（9画面）。
- `python3 scripts/validate_assets.py`: PASS、530アセット・5事件、問題なし。
- `npm run validate:cases`: 5事件・30資料成功。
- `npm run check:assets`: 参照先すべて実在・マニフェスト登録済み。
- `qa/coverage.json` 確認済み。これは本番準備の棚卸しであり、テストカバレッジ率ではない。MVP項目は揃っているが、本番向け原画・権利承認・実機QAなどは未完了。

## 変更ファイル

- `src/screens/HomeScreen.tsx`: 新聞一面と既存4人の集合。
- `src/screens/CaseSelectScreen.tsx`: 個別表紙と資料確認進捗。
- `src/screens/InvestigationScreen.tsx`: 資料を並べるデスク領域と操作案内。
- `src/components/DocumentTile.tsx`: 種別属性とHTMLの種別見出し。
- `src/components/DocumentDialog.tsx`: 資料ラベルと2Dページ演出。
- `src/components/EvidenceBoard.tsx`: 関係性を確認する案内。
- `src/app/screens/collage.css`: C-2紙面・レスポンシブ・状態・動きの全体スタイル。
- `src/app/tokens.css`: 和文見出し用書体。
- `src/main.tsx`: 新規スタイルの読み込み。
- `docs/reviews/c2-ui-review.md`: この記録。
- `qa/ui-c2/before/*.png`、`qa/ui-c2/after/*.png`: 修正前後20画像。
- `qa/ui-c2/viewport-results.json`: 54チェックの計測結果。

## 維持事項・未解決事項

事件JSON、正解、推理・予算・採点ロジック、保存形式を変更していない。証拠の正誤に応じた表示は追加していない。タップ・キーボードによる照合を維持した。

未解決: 初回E2Eで見られた履歴検証の間欠的失敗は、追加検証では再現していない。実機・Safari/Firefox・スクリーンリーダーの実ユーザー検証は今回未実施。キャラクター原画と今回の配置を含めた人手のアート承認は別途必要であり、未レビュー素材をリリース承認済みとは扱わない。このリポジトリは引き続きスターターで、本番認定済みアプリではない。

GitHubへのpush・PR作成・デプロイは実施していない。
