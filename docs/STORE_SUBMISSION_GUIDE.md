# ストア配信を決めた場合の素材/手順

現在の決定は **Web/PWA-first**。App Store/Google Playに出す場合、ネイティブアプリの実装手段・年齢区分・課金・ストア登録を別途決める。

- 配布物：`public/assets/brand/` にベースアイコン、OGP、スプラッシュはある。
- ストア用スクリーンショット：**最終版アプリの実画面から**取得。モック・設計図はストア提出版として扱わない。
- 仕様は改訂される。提出時点の公式要件を再確認。
- Appleの公式仕様（参照日2026-10-24）：https://developer.apple.com/jp/help/app-store-connect/reference/app-information/screenshot-specifications
- PWAインストール仕様：https://developer.mozilla.org/ja/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- 実画面PNGは透過なし。iPhoneと対応させるiPad等の必要なサイズを確認。
