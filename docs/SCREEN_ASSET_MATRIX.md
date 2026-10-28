# 画面ごとの必要アセット・表示状態

> 画像は収録されていても、正式デザインレビューと画面実装は別作業。

| 画面 | 参照すべき素材 | 必須の状態 |
|---|---|---|
| タイトル・ホーム | `brand/wordmark-dark.svg, brand/symbol.svg, brand/hero-1600x900.png, backgrounds/scene-menu.svg, characters/shinobu/poses/idle.png, audio/menu-open.wav` | 初回/再開/ローディング/保存失敗 |
| 事件選択 | `cases/case-01〜05/cover.png, ui/frames/case-card.svg, ui/states/{new,clear,locked}.svg` | 一覧/解放済み/未解放/読み込みエラー |
| 事件導入 | `backgrounds/scene-office.svg, characters/harada/poses/idle.png, tutorial/step-01.png` | 説明/開始/スキップ |
| 調査デスク | `backgrounds/scene-office.svg, cases/<id>/documents/<docid>.png, ui/icons/{inspect,pin,budget}.svg` | 未読/既読/調査コスト不足/ドキュメント破損 |
| 資料閲覧 | `ui/frames/newspaper.svg, ui/stamps/confidential.svg, props/*.svg` | ズーム/スクロール/戻る |
| 証拠ボード | `backgrounds/scene-caseboard.svg, ui/frames/evidence-pin.svg, ui/icons/{link,pin,trash}.svg` | 0枚/2枚/矛盾/リセット |
| 計算デスク | `ui/icons/calculate.svg, ui/states/verified.svg` | 空欄/数値不正/再計算/正解 |
| 記事作成 | `ui/frames/clipping.svg, ui/icons/edit.svg, ui/stamps/draft.svg` | 断片未選択/並び替え/記事プレビュー |
| 結果・種明かし | `ui/grades/*.svg, ui/stamps/{accepted,rejected}.svg, effects/reactions/*.svg` | 成功/失敗/次へ/再挑戦 |
| バイアス図鑑 | `encyclopedia/*.png, ui/icons/book.svg` | 未解放/解放済み/説明 |
| 事件手帳 | `achievements/*.png, ui/icons/achievement.svg` | 0件/進捗あり/コンプリート |
| 設定・ヘルプ | `ui/icons/{settings,sound,mute,reset}.svg, tutorial/*.png` | 音/モーション低減/全データ削除 |
| オフライン・エラー | `ui/illustrations/{offline,error,empty}.svg` | 通信なし/ケース欠損/破損保存 |
| 配信・SNS | `brand/app-icon-*.png, brand/ogp-1200x630.png, brand/share-card-1200x630.png` | 正式ビルドからストアスクリーンショットを別途取得 |

## 外部素材依存のないルール

- 重要な数値・見出し・解説はHTMLやJSONテキストで表示し、画像内文字へ焼き込まない。
- 背景・書類の紙質感を装飾として扱い、タップや計算はUI機能として実装。
- Reactへ移行時は`public/assets`を実URL `/assets` として参照する。
- ストアスクリーンショットは実ゲーム画面が完成した後で作り、制作前の静的モックで代替しない。
