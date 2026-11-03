# CASE00の遊び方体験

## Sub-features

最初の選択、資料を読む、答えと根拠、報告と振り返り。

## How to get to it (user POV)

事件一覧の「CASE 00 で遊び方を体験する」を押す。

## Driving it with Playwright

`npm run test:e2e -- e2e/case00.spec.ts --project=chromium`。このブランチのCASE00の実装に合わせた既存のテストを使う。

## Gotchas

PR #149の新しいCASE00はこのブランチには含まれない。両PRが統合されたら、#149のtutorial.mdとCASE00用テストを使う。CASE02のためにCASE00の期待値を変えない。
