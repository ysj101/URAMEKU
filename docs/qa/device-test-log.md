# 実機検証 記録表 — MVP-042

手順と期待結果は `docs/qa/device-test-plan.md`。対象端末の一覧と総合判定は `qa/device-matrix.json`。
端末 1 台（1 モード）につき下の「端末セクション テンプレート」を 1 つ複製して埋める。

結果の値: `pass` / `fail` / `blocked` / `not-run`。重大度: S1 / S2 / S3 / S4（手順書 2.3）。

## 実施状況

| 日付 | 対象 ID（device-matrix.json） | 担当 | ビルド（SHA） | 配信方法 | 総合判定 |
| --- | --- | --- | --- | --- | --- |
| （未実施） | ios-safari-latest | — | — | — | not-run |
| （未実施） | ios-safari-latest-pwa | — | — | — | not-run |
| （未実施） | ios-safari-previous | — | — | — | not-run |
| （未実施） | android-chrome-latest | — | — | — | not-run |
| （未実施） | android-chrome-latest-pwa | — | — | — | not-run |
| （未実施） | android-chrome-small | — | — | — | not-run |
| （未実施） | ipados-safari-latest | — | — | — | not-run |

## 不具合一覧

`fail` の項目はここに 1 行ずつ追加し、GitHub Issue を起票する。

| # | 対象 ID | シナリオ | 重大度 | 症状（1 行） | 再現手順 / 証跡 | Issue |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | （未実施） | — | — |

---

## 端末セクション テンプレート

複製して「### <対象 ID>」に置き換える。

### <対象 ID>

| 項目 | 値 |
| --- | --- |
| 端末名 | |
| OS とバージョン | |
| ブラウザとバージョン | |
| モード | browser / pwa |
| 画面幅（CSS px）・向き | |
| ビルド（コミット SHA） | |
| 配信方法と URL | LAN (`scripts/serve_lan.sh`) / GitHub Pages / その他 |
| 前提 | 効果音の組み込み: 済 / 未 、HTTPS: 有 / 無 |
| 日付・担当 | |

#### 共通シナリオ

| ID | 結果 | 重大度 | 備考（症状・再現手順・証跡のファイル名） |
| --- | --- | --- | --- |
| T01 | not-run | | |
| T02 | not-run | | |
| T03 | not-run | | |
| T04 | not-run | | |
| T05 | not-run | | |
| T06 | not-run | | |
| T07 | not-run | | |
| T08 | not-run | | |
| T09 | not-run | | |
| T10 | not-run | | |
| T11 | not-run | | |
| T12 | not-run | | |
| T13 | not-run | | 外付けキーボードが無ければ blocked |

#### 実機固有シナリオ

| ID | 結果 | 重大度 | 備考（症状・再現手順・証跡のファイル名） |
| --- | --- | --- | --- |
| M01 | not-run | | 鳴り始めたタップの回数: |
| M02 | not-run | | iOS のみ。Android は not-run のまま |
| M03 | not-run | | 復帰後の効果音: 鳴る / 鳴らない |
| M04 | not-run | | |
| M05 | not-run | | 機内モードでの新規読み込み時の表示: |
| M06 | not-run | | ツールバー伸縮時 / 横向き / PWA 上下端 |
| M07 | not-run | | |
| M08 | not-run | | 出たキーボードの種類: |
| M09 | not-run | | |
| M10 | not-run | | MVP-022 統合前のビルドなら blocked |
| M11 | not-run | | 設定した倍率: |
| M12 | not-run | | browser モードでは not-run |
| M13 | not-run | | |

#### 総合判定

- 判定: not-run
- S1 件数: — / S2 件数: — / S3 件数: — / S4 件数: —
- 所見（自由記述）:
