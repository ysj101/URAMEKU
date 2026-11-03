---
name: verify-urameku
description: ウラメクのWeb UIをPlaywrightで操作し、CASE00の直感で選ぶ体験、種明かし、CASE02のミニ実験、事件調査と画面幅を検証する。
---

# ウラメクのUI検証

2026-11-03に、以下の手順でCASE00を `CI=1 npm run test:e2e`（chromium・mobile-chromium 94件成功）と画像保存まで通した。サンドボックスでChromiumを起動できない環境では、サンドボックス外で実行する。

CASE02の追加経路は [ミニ実験](features/case02-experiment.md) を参照する。CASE02のブラウザー検証と画像保存はサンドボックス外での実行待ち。このブランチで実測した成功結果として扱わない。

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

1. ホームの「調査をはじめる」を押す。直接 `#/tutorial` に進み、「映画の前に、ひと休み」が出る。
2. のどのかわきとポップコーン代の事情、直感で選ぶ案内を確認する。事件名、Mの追加、おとり効果、資料、解説画像とaltはまだ表示されない。
3. SかLを選び「これにする →」を押す。Mが加わり、最初の選択が表示される。
4. もう一度選び「資料を開く →」を押す。2枚の資料を開く。未読資料、読み終えた後の「答えを選ぶ →」が順番に主ボタンになる。
5. 答えと根拠を選び「報告をまとめる →」、確認画面で「報告する →」を押す。
6. 種明かしで選択したサイズと変更の有無、1回では効果を断定できない説明、コラムと出典を確認する。S→L、S→Sの両方を試す。
7. 「本編へ進む →」でCASE01に進む。完了後にホームへ戻り、reloadして「調査をはじめる」を押してもCASE01に進む。

```sh
URAMEKU_HOOK_SHOTS="/tmp/urameku-case00-shots" npm run test:e2e -- e2e/case00.spec.ts --project=chromium --project=mobile-chromium --workers=2
CI=1 npm run test:e2e
```

CASE02は以下の専用テストを使う。

```sh
URAMEKU_SHOTS="/tmp/urameku-case02-shots" npm run test:e2e -- e2e/case02-experiment.spec.ts --project=chromium --workers=2
CI=1 npm run test:e2e
```

## Evidence

テストは1280x800、390x844と既存の320px文字200%を確認する。画像は指定ディレクトリのプロジェクト名・選択経路ごとのフォルダーに保存する。`01-scenario`、`02-first-choice-made`、`03-menu-changed`、`04-reveal`、`05-docs`、`06-report`、`07-debrief-column` に画面寸法を付ける。`04-reveal` は選択後の種明かしを記録し、資料や報告の画像とは保存順が異なる。

画像はfullPageで保存する。文字の矩形、祖先のoverflowによる切れ、各段階に主ボタンが1つあることをテストし、画像でも次に押す場所を確認する。結果はリポジトリ外の検証ログに残す。

CASE02は1280x800と390x844でA/Bを検証する。画像はリポジトリ外の指定先にプロジェクト名のフォルダーを作り、条件と画面寸法を付けてfullPageで保存する。`01-experiment-start`、`02-initial-choice-made`、`03-compare`、`04-final-column` を残す。

テストは実際のボタンで選び、資料を開いて読み、比較後の理由を記録する。保存後のreloadでもコラムが残ることを確認する。Aだけは選択前の空の保存状態を作り、初期条件IDを検証用ストレージで指定する。回答、読了、完了状態は注入しない。Bは通常の固定割当を使う。

各段階で主ボタンを1つ確認し、文字の矩形と祖先のoverflowを調べる。画像でも文字の欠けと次に押す場所を確認する。ブラウザーを起動できない場合は、テストの準備済みと実行成功を区別して報告する。

## Cleanup

自分が起動したdevサーバーにCtrl-Cを送る。手動作成したbrowserとcontextはcloseする。証拠画像とログは消さない。

## Features

[機能と検証経路](features/README.md)を参照する。
