---
name: verify-urameku
description: ウラメクのWeb UIをPlaywrightで操作し、CASE02のミニ実験、CASE00、事件調査と画面幅を検証する。
---

# ウラメクのUI検証

PR #149と同じパス・章構成を使う。CASE02の追加経路は [ミニ実験](features/case02-experiment.md) を参照する。CASE02のブラウザー検証と画像保存はサンドボックス外での実行待ち。このブランチで実測した成功結果として扱わない。

## Launch

このワークツリーで起動する。node_modulesがなければ先にnpm ciを実行する。

```sh
export PATH="$HOME/.nvm/versions/node/v26.12.1/bin:/opt/homebrew/bin:$PATH"
npm run dev -- --host 127.0.0.1 --port 53187 --strictPort
```

`Local: http://127.0.0.1:53187/` が準備完了の目印。空のブラウザーコンテキストでタイトル「ウラメク」を確認する。認証や外部APIは不要。Playwrightテストは4175ポートでbuildとpreviewを自動起動する。

## Doctor

`curl --fail http://127.0.0.1:53187/` で `id="root"` と `/src/main.tsx` を確認する。ポートが使用中なら他のプロセスを終了せず、別ポートを使う。画面がおかしいときはブラウザーのconsoleとpageerrorも調べる。

## Drive

検証専用コンテキストで `page.goto('/')`、`page.evaluate(() => localStorage.clear())`、`page.reload()` を実行し、初回状態にする。実データの削除には使わない。

[機能と検証経路](features/README.md)から対象を選ぶ。CASE02は以下の専用テストを使う。

```sh
URAMEKU_SHOTS="/tmp/urameku-case02-shots" npm run test:e2e -- e2e/case02-experiment.spec.ts --project=chromium --workers=2
CI=1 npm run test:e2e
```

## Evidence

CASE02は1280x800と390x844でA/Bを検証する。画像はリポジトリ外の指定先にプロジェクト名のフォルダーを作り、条件と画面寸法を付けてfullPageで保存する。`01-experiment-start`、`02-initial-choice-made`、`03-compare`、`04-final-column` を残す。

テストは実際のボタンで選び、資料を開いて読み、比較後の理由を記録する。保存後のreloadでもコラムが残ることを確認する。Aだけは選択前の空の保存状態を作り、初期条件IDを検証用ストレージで指定する。回答、読了、完了状態は注入しない。Bは通常の固定割当を使う。

各段階で主ボタンを1つ確認し、文字の矩形と祖先のoverflowを調べる。画像でも文字の欠けと次に押す場所を確認する。ブラウザーを起動できない場合は、テストの準備済みと実行成功を区別して報告する。

## Cleanup

自分が起動したdevサーバーにCtrl-Cを送る。手動作成したbrowserとcontextはcloseする。証拠画像とログは消さない。

## Features

[機能と検証経路](features/README.md)を参照する。
