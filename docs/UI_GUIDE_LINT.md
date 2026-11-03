# UI 設計ガイドの lint

画面の文言・設定項目・配色が、使いやすい画面の基本から外れていないかを機械的に確かめる仕組み。
人手レビューの代わりではなく、同じ間違いを繰り返さないための網である。

出典は「UI 設計の基本」（<https://singularitysociety.github.io/societys_statement/development/ui_design/README.html>）。
Issue #161 で導入した。

## 実行

```bash
npm run lint:ui && npm run lint
```

CI では「Validate content」ステップで `lint:ui` を、「Lint」ステップで ESLint を走らせる。

## 何を見るか

| 見る場所 | 検出するもの | 直し方 | 根拠 |
| --- | --- | --- | --- |
| `src/**/*.tsx` のボタン、`data/ui/ja.json` | 文言が「戻る」だけで行き先がない | 「事件一覧へ」のように行き先を書く。ダイアログを閉じるなら「閉じる」 | 第1章 ×は閉じる、第7章 行き先を書く |
| 同上 | 「OK」「はい」「いいえ」「キャンセル」 | 「削除する」「やめる」のように押した結果が分かる動詞にする | 第3章 ボタンは動詞 |
| 同上 | 文字も `aria-label` も無いボタン（jsx-a11y の `control-has-associated-label` は式を子に持つボタンを誤検出するので使わない） | 見える文字を添える。無理なら `aria-label` | 第2章・第6章 アイコンに言葉 |
| `aria-pressed` / `role="switch"` のボタン、`ja.json` の `settings.*` | 「〜しない」「〜を減らす」「ミュート」など否定形の項目名 | 「〜する」にそろえ、オン = 有効にする。状態は「〜中」、ボタンは押した後の動作（「ミュートを解除」）で書く | 第3章 肯定形、第7章 状態と操作を分ける |
| `src/app/tokens.css` | 用途トークン（`--color-*`）の文字色 × 背景色のコントラストが 4.5:1 未満（無効色は 3:1） | 文字色を濃くするか、組み合わせを変える。確かめる組み合わせは docs/DESIGN_TOKENS.md の表と同じで、`scripts/lint_ui_guide.mjs` の `CONTRAST_PAIRS` に持つ。控えの鍵に比率が入るので、控えにある組み合わせでも今より悪くなると失敗する | 第6章 WCAG 1.4.3 |
| ESLint（`src/**/*.tsx`、テスト除く） | `confirm()` `alert()` `prompt()`、`window.confirm` など | 画面内の 2 段階確認にする（例: `ResetProgressPanel`） | 第4章 確認は画面内で、ボタンは動詞 |
| ESLint `eslint-plugin-jsx-a11y`（recommended） | 画像の alt 無し、ラベルの無いフォーム部品、`role` と要素の不一致、クリックだけでキー操作が無い要素など | ルールのメッセージに従う。意図があって外す場合は理由をコメントに書いて `eslint-disable-next-line` | 第2章・第6章 |
| ESLint | `role="tab"` に `onKeyDown` が無い | 左右の矢印キー・Home・End で移動できるようにする（`EncyclopediaScreen` の `onTabKeyDown` と同じ） | 第6章 キーボード操作、第1章 同じ振る舞い |

## 控え（baseline）

`qa/ui-guide-baseline.json` は、仕組みを入れる前から残っている指摘を一時的に見逃すための控え。
控えにない新しい指摘だけが失敗になる。

- 新しい指摘を控えに足してはいけない。文言か色を直す。
- 古い指摘を直したら `node scripts/lint_ui_guide.mjs --update-baseline` で控えを減らす。
- `node scripts/lint_ui_guide.mjs --no-baseline` で控えの中身も含めて全部見られる。
- 控えに残っている分は Issue #153（やり直しの文言）、#154（設定トグル）、#156（コントラスト）、#158（資料ダイアログの「戻る」）で直す。

ESLint 側の既存違反は `eslint-disable-next-line` と `TODO(#番号)` で印を付けている（#153、#160）。
直したらコメントごと消す。

## 機械判定しないもの

次は人手レビューで見る（docs/qa/a11y-checklist.md、docs/QA_CHECKLIST.md）。

- 色だけで状態を区別していないか（#155）
- 押せないボタンの近くに理由があるか、必須の表示があるか（#157）
- 入力途中の値がタブ切り替えで消えないか
- 一画面の主ボタンが 1 つか、危険な操作が離れているか
- 現在地（何番目の手順か）が見えるか
