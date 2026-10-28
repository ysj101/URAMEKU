# E2E 検証（Playwright）

MVP-041 で追加。`docs/TEST_STRATEGY.md` のシナリオ検証（T01〜T13）のうち、ブラウザ操作で
再現できるものを `e2e/` に自動化している。対象は `vite build` した成果物（`vite preview`）で、
開発サーバーではない。

## 実行方法

```sh
npm ci
npx playwright install chromium          # 初回のみ（ブラウザ本体の取得）
npm run test:e2e                         # 既定: 全プロジェクト（下記）
npx playwright test --project=chromium   # PC Chromium だけ
npm run test:e2e:ui                      # UI モードで 1 件ずつ確認
```

`playwright.config.ts` の `webServer` が `npm run build && npm run preview -- --port 4175 --strictPort`
を起動し、`http://localhost:4175/` を `baseURL` にする。ローカルでは既に 4175 で preview が
動いていればそれを再利用する（`reuseExistingServer`）。

### プロジェクト

| プロジェクト | 内容 | CI |
|---|---|---|
| `chromium` | Desktop Chrome（PC 主要ブラウザの代表） | 実行 |
| `mobile-chromium` | 390×844（iPhone 13 相当）、タッチ有効。T12 相当 | 実行 |
| `firefox` | Desktop Firefox | ローカルのみ |
| `webkit` | Desktop Safari 相当 | ローカルのみ |

Firefox / WebKit をローカルで回すには、ブラウザ本体を追加で取得する。

```sh
npx playwright install firefox webkit
npx playwright test --project=firefox --project=webkit
```

`CI` 環境変数が設定されていると firefox / webkit プロジェクトは定義されない
（`npx playwright test --project=firefox` は「プロジェクトが無い」で失敗する）。

### 失敗時の確認

- `playwright-report/`（HTML レポート。CI ではアーティファクト `playwright-report`）
- `test-results/<テスト名>/`: スクリーンショット、`error-context.md`（失敗時の
  アクセシビリティツリー）、`trace.zip`（`npx playwright show-trace <zip>`）

どちらも `.gitignore` 済み。

## CI での扱い

`.github/workflows/ci.yml` のジョブ `E2E (chromium)` が、既存の `CI` ジョブとは独立に
`npx playwright install --with-deps chromium` → `npm run test:e2e` を実行する
（`CI=1` のため chromium / mobile-chromium のみ、失敗時 2 回リトライ、worker 2）。
HTML レポートは常にアーティファクトとして保存する。

ブランチ保護の必須チェックは今のところ `CI` のみ（`docs/CI.md`）。E2E を必須にする場合は
`E2E (chromium)` を required status checks に追加する。

## シナリオ一覧と T 番号の対応

| ファイル | テスト | T 番号 |
|---|---|---|
| `e2e/case01-clear.spec.ts` | ホーム → 事件一覧 → CASE 01。6 資料・残予算 4 を確認し、`trial` / `paid` / `retained` を開いて読む（開いた資料はそのままボードに並ぶ）→ 2 枚（登録台帳 ↔ 翌月の継続状況）を照合 → 検証メモ 45 / 90 → 断片 3 つ（正解順）→ 提出 → 「掲載可能」見出し、評価点 96 / 100、編集後記、架空注記 → 「次の事件へ」で CASE 02 | T01, T04, T05, T06, T08 |
| `e2e/case01-fail.spec.ts` | 見出し 3 つだけ正答して提出 → 差し戻し（30 / 100）。不足種別（証拠 3 件・照合・計算 2 問）が出て、必要資料名・答え・答え合わせは**出ない** → 「解説と正解を公開する」で正解表示 → 「記事を修正する」で断片が残ったまま記事画面へ | T07 |
| `e2e/budget.spec.ts` | 無料資料は予算を減らさない / 有料資料を 2 度開いても 1 回分 / 外れ資料 2 件で詰み案内 → 「この事件を最初からやり直す」（`window.confirm`）で復帰 | T02, T03, T09 |
| `e2e/persistence.spec.ts` | 記事画面まで進めてリロード → 事件・段階・閲覧・照合・メモが復元、ホームが「前回の続き」 → 設定の「この端末の記録をすべて削除」（2 段階確認）→ 初期状態、`localStorage` のキーが消える | T10, T11 |
| `e2e/dialog-history.spec.ts` | 資料ダイアログを ピン / 戻るボタン / Esc / ブラウザの戻る の 4 経路で閉じても URL が `#/play/case-01` のままで、その後の戻る 1 回で `#/cases` に戻る（余分な履歴が残らない） | （MVP-022 の履歴同期） |
| `e2e/navigation.spec.ts` | `#/play/case-05` / `#/encyclopedia` / `#/settings` / `#/tutorial` の直接指定で各画面が開く。不明なハッシュはホーム | （MVP-020 のハッシュルート） |

`mobile-chromium` では上記すべてを 390×844 で実行する（T12 の「ボタンが隠れず操作可能」の
自動化部分。Playwright はクリック前に要素が他の要素に覆われていないことを検査する）。

### 自動化していないもの

- T13（Tab / Enter だけの操作）: 単体テスト（`src/components/*.test.tsx`）でキーボード操作を
  検証している。E2E での全画面通しは未対応。
- T14（JSON の数字を変えたときの検出）: `npm run validate:cases` と domain の単体テストが担当。
- 実機（iOS Safari / Android Chrome）: `docs/qa/device-test-plan.md` の手動検証。

## 書き方の方針

- 要素は `getByRole` / `getByLabel` / 表示文言で取得し、`data-testid` は既存のもの
  （`link-status`, `case-disclaimer`）以外を増やさない。文言の変更は E2E の変更を伴う。
- CASE 01 の題名・資料名・問いの文言は `e2e/helpers.ts` の `CASE01` にまとめている
  （正本は `data/cases/case-01.json`）。答えはテストを通すために変えない。
- 各テストは新しいブラウザコンテキスト（空の `localStorage`）で始まる。
