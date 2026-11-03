# 通常事件の調査

## Sub-features

資料を読む、情報解読、証拠ボード、調査報告と振り返り。

## How to get to it (user POV)

タイトルから事件一覧に入り、CASE01などを選ぶ。

## Driving it with Playwright

`e2e/helpers.ts` の `gotoCase01`、`openAndRead`、`showDesk`、`prepareV2Case` が既存UIを操作する。`npm run test:e2e -- --project=chromium --project=mobile-chromium` で全経路を確認する。資料を読むと「調査済み」、報告提出で「STEP 03 / 判断を振り返る」が出る。

## Gotchas

通常事件への直接URLはCASE00を通らない。資料と予算はJSONに従う。検証のために答えや事件データを変更しない。
