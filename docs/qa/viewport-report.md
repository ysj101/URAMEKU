# スマホ幅 UI 検査レポート（MVP-040）

対象: 320 / 375 / 390 / 430px × 全画面。受け入れ条件は「横スクロールなし・主要ボタン 44px 相当」。

## 検査方法

- 検査ツール: `scripts/check_viewports.mjs`（`agent-browser` CLI を `child_process` で呼び、`eval` で DOM を計測）。
- 実行手順:

  ```sh
  npm run build && npx vite preview --port 4174 &
  node scripts/check_viewports.mjs            # 別ポートなら --base http://localhost:PORT
  ```

- 判定:
  - 横スクロール: `document.documentElement.scrollWidth <= clientWidth`
  - 44px: 表示中の `button, a, input, select, textarea, summary, [role=button], [role=tab]` の `getBoundingClientRect()` が幅・高さとも 44px 以上。`display: inline` のテキストリンク、`display: none`、画面外退避中（skip-link）は対象外。モーダル表示中は `dialog[open]` 内だけを対象にする。
  - はみ出し: レイアウト幅の右端を超える要素（`position: fixed / absolute` を除く）。
- 画面状態: 調査〜結果は `localStorage`（`src/state/persistence.ts` の v3 形式）に進行状態を注入して再現する。
  - `play-investigate`: 資料 2 件を開く（開いた資料はそのまま根拠候補）
  - `play-board`: 必要資料 3 件を採用、資料 A を選択中、検証メモ 1 件入力
  - `play-dialog`: 既読タイルを `eval` で click して資料ダイアログを開いた状態
  - `play-article`: 断片 2 つを配置
  - `play-result-approved`: 掲載承認（正解）
  - `play-result-rejected`: 差し戻し + 解説公開（配点表・差し戻し理由・答え合わせを表示）
- スクリーンショット: `qa/screenshots/<幅>-<画面>.png`（viewport）と `-full.png`（全ページ）。`.gitignore` 済みでコミットしない。
- 注意: ヘッドレス Chromium は縦スクロールバーが約 15px の幅を取るため、レイアウト幅は実機より狭い（320px 指定で 305px）。実機（オーバーレイスクロールバー）より厳しい条件での検査になる。

## 結果（2026-10-24、ブランチ mvp-040）

### Before（integration/wave-2b）

| 画面                 | 320px                    | 375px                    | 390px                    | 430px                    |
| -------------------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| home                 | OK                       | OK                       | OK                       | OK                       |
| cases                | OK                       | OK                       | OK                       | OK                       |
| tutorial             | OK                       | OK                       | OK                       | OK                       |
| encyclopedia         | OK                       | OK                       | OK                       | OK                       |
| settings             | 44px 未満 2（音声 UI） | 44px 未満 2（音声 UI） | 44px 未満 2（音声 UI） | 44px 未満 2（音声 UI） |
| play-investigate     | OK                       | OK                       | OK                       | OK                       |
| play-board           | OK                       | OK                       | OK                       | OK                       |
| play-dialog          | OK                       | OK                       | OK                       | OK                       |
| play-article         | OK                       | OK                       | OK                       | OK                       |
| play-result-approved | OK                       | OK                       | OK                       | OK                       |
| play-result-rejected | OK                       | OK                       | OK                       | OK                       |

横スクロール: 0 / 44 ケース。44px 未満: 8 件（`.audio-control__mute` 112×30、音量スライダー 129×16 が 4 幅とも）。

数値には出ないが、スクリーンショットで確認した見た目の問題:

- ホーム 320px: 見出し「ウラメク」と「ARCHIVE 001」の行がマスコットと重なる。
- 資料タイルの識別ラベル（DocumentLabel）の種別アイコンが `.doc-tile img`（65×78px）に当たって巨大化し、ラベルが 3〜4 行に折り返す（全幅。390px 幅で特に窮屈）。
- `.case-mascot` が 91×98px 固定で原画比率（3:4）が潰れる。
- 320px の「証拠ボード」節見出しが `small` に押されて文字の途中で折り返す（「証拠ボー / ド」）。
- `viewport-fit=cover` だが `env(safe-area-inset-*)` 未使用。

### After（本 PR）

| 画面                 | 320px | 375px | 390px | 430px |
| -------------------- | ----- | ----- | ----- | ----- |
| home                 | OK    | OK    | OK    | OK    |
| cases                | OK    | OK    | OK    | OK    |
| tutorial             | OK    | OK    | OK    | OK    |
| encyclopedia         | OK    | OK    | OK    | OK    |
| settings             | OK    | OK    | OK    | OK    |
| play-investigate     | OK    | OK    | OK    | OK    |
| play-board           | OK    | OK    | OK    | OK    |
| play-dialog          | OK    | OK    | OK    | OK    |
| play-article         | OK    | OK    | OK    | OK    |
| play-result-approved | OK    | OK    | OK    | OK    |
| play-result-rejected | OK    | OK    | OK    | OK    |

OK = 横スクロールなし / 44px 未満 0 / はみ出し 0。44 ケースすべて OK（終了コード 0）。

### 44px の例外

なし。インラインのテキストリンク（`display: inline` の `a`）は判定対象外だが、現行画面には該当要素が無い。

## 修正内容

- `src/app/global.css`
  - 試作（prototype/）由来の未参照ルールを削除: `.masthead` `.brand p` `.logo-char` `.page` `.sidebar` `.small-heading` `.case-list` `.case-option*` `.info-panel*` `.link-button` `.pins` `.pin-card*` `.link-slot` `.result .grade` `.calculation-desk` `.calc-field*`（`grep -rn` で `className` 参照が無いことを確認。`src/components/CaseList.tsx` は `.case-list` を使うが、どこからも import されていない未使用コンポーネント）。
  - `.case-mascot`: 固定 91×98px → `width` + `aspect-ratio: 3 / 4`（820px 以下 64px、430px 以下 56px）。
  - `.doc-tile img` → `.doc-tile > img`（識別ラベルや状態アイコンに 65×78px が当たらないように）。
  - `.section-title`: `flex-wrap: wrap` + gap（見出し文字の途中で折り返さない）。
  - 430px 以下: `.case-header` / `.result` / `.document-popup` / 配点表の余白を詰める。
- `src/app/layout.css`
  - `.app-main` の padding に `env(safe-area-inset-*)` を加算。
  - ホーム: 見出しを `clamp(2.5rem, 12vw, 6rem)` にし、hero の右にマスコット幅の余白を確保。
  - 設定: `AudioControl`（ミュートボタン・音量スライダー）を 44px 以上に。`MotionToggle` の余白。
- `src/app/screens/desk.css`: タイル内の識別ラベルを中央寄せ、430px 以下では区切り記号（`aria-hidden`）を非表示。
- `src/app/screens/board.css`: 「外す」ボタンの文言を折り返さない。
- `index.html`: 変更なし（`viewport-fit=cover` は設定済み）。
- TSX: 変更なし。

## 未対応・人手確認が必要なこと

- 実機（iOS Safari / Android Chrome）での確認は未実施。`docs/qa/device-test-plan.md` の手順で確認する。特に `env(safe-area-inset-*)` はホーム画面に追加した PWA 表示でしか効かない。
- 320px の事件見出し（「消えた55人の利用者」）はマスコットの横で 2 行になる。はみ出しは無い。
- 文字倍率 200%（ブラウザのフォント設定）での検査はこのスクリプトの対象外。
