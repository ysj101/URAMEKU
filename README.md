# ウラメク — 見えているのは、ほんの一部。

**新聞・雑誌コラージュの世界で、限られた調査予算で証拠を集め、資料を照合・検算し、根拠に基づく記事を作る推理ゲーム。**

> これは「GitHubに置ける開発スターター一式」です。**本番公開可能な完成アプリではありません。** 画像の一部は正式アート承認前、既存試作は統合UIテスト前です。

## 何が入っている？

- MVPの実装タスク（GitHub Issue化可能な**45件**）：[`docs/MVP_IMPLEMENTATION_TASKS.md`](docs/MVP_IMPLEMENTATION_TASKS.md)
- 本番化・配信のタスク（**46件**）：[`docs/PRODUCTION_RELEASE_TASKS.md`](docs/PRODUCTION_RELEASE_TASKS.md)
- 事件5件・調査資料30件・自由数値検証10問のゲームデータ：`data/cases/`
- ロゴ・アイコン・UI・背景・事件資料サムネイル・図鑑・音：`public/assets/`
- C-2正本の比較画像と編集用の素材：`design/`
- 各アセットの実在パスとSHA256：[`assets.manifest.json`](assets.manifest.json)
- 収録済みと未完成の分類：[`qa/coverage.json`](qa/coverage.json)
- 静的な操作試作：`prototype/`

## 試作の起動

```bash
python3 -m http.server 8000
```

ブラウザで <http://localhost:8000/prototype/> にアクセス。`file://` ではJSON fetchが制限されるため、ローカルHTTPサーバーで起動。

試作は React/Vite の完成実装ではありません。ブランドとパスをウラメク用に更新したうえで、既存のゲームロジックを保持しています。

## 開発環境

Node.js 22（`.nvmrc`）と npm を使用します。

```bash
npm ci               # 依存の再現インストール
npm run lint         # ESLint
npm run typecheck    # TypeScript 型検査
npm run format:check # Prettier 整形チェック（npm run format で修正）
npm run check        # 上記をまとめて実行
```

## フォルダ概要

```text
.
├── README.md
├── docs/
│   ├── MVP_IMPLEMENTATION_TASKS.md
│   ├── PRODUCTION_RELEASE_TASKS.md
│   ├── ASSET_INVENTORY.md
│   ├── ART_BIBLE.md
│   ├── RELEASE_CRITERIA.md
│   └── ...
├── public/
│   ├── manifest.webmanifest
│   └── assets/
│       ├── brand/ backgrounds/ textures/ characters/
│       ├── ui/ cases/ encyclopedia/ tutorial/
│       ├── effects/ achievements/ audio/ icons/ props/
├── data/ cases/ schema/
├── src/            # React/TS移行向けの画像・音参照ヘルパー
├── prototype/      # 静的JS試作
├── design/          # 正本画像と旧編集データ
├── previews/        # 収録素材のコンタクトシート
├── scripts/         # 品質検査のローカルスクリプト
└── qa/             # 品質検査・不足判定
```

## アート方針

- 正本：[`design/reference/c2-canonical-board.png`](design/reference/c2-canonical-board.png)
- メガ・クロ・ハラダ部長の独立全身ポーズは元から不足。ZIPに存在しないものを存在することにはしない。
- `reactions/` と `icons/` は基準の顔を再作画せず**記号を重ねた表情補助状態**。正式な顔の表情作画とは異なる。
- 構図・アプリアイコン・紙の装飾はSVG/PNGで編集できる。画像内の見出しはゲームのデータ本文の代替にしない。

## 公開判定

`docs/RELEASE_CRITERIA.md` にG0〜G5を定義。ZIPのファイル整合が通ることは、本番ビジュアルの品質、法律上の権利、アプリの実機動作、ストア審査を保証しません。

## 出典・権利

ゲームケースの数値・企業・人物は創作です。配布物にフォントバイナリは含みません。ソースコードとキャラクター画像について第三者に利用許諾するためのLICENSEは未決定です。`docs/LEGAL_ASSET_REVIEW.md` を確認し、公開ライセンスを決めてください。
