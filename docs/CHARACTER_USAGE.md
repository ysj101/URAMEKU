# キャラクター表示の使い方（MVP-035）

キャラクターは **承認済み原画** だけを表示する。表情・感情の変化は原画の顔を差し替えず、
`effects/reactions/` の記号を重ねて表現する（別人化しない）。
コードからの入口は `src/components/CharImage.tsx` と `src/components/CharacterReaction.tsx` の 2 つだけ。
URL は `src/data/assets.ts` のヘルパーが解決し、`<img>` に `/assets/...` を直書きしない。

## 使える組み合わせ

収録されているものだけを使う。無い組み合わせは型エラー（実行時は例外）。

| キャラ | `pose`（原画） | `reaction`（原画＋記号の補助状態） | `effect`（記号を重ねる） |
| --- | --- | --- | --- |
| シノブ `shinobu` | `idle` `point` `inspect` `explain` | `idle` `happy` `surprised` `thinking` `worried` | 6 種すべて |
| メガ `mega` | `idle` のみ | 同上 | 同上 |
| クロ `kuro` | `idle` のみ | 同上 | 同上 |
| ハラダ部長 `harada` | `idle` のみ | 同上 | 同上 |

`effect`: `conflict`（矛盾） `discovery`（発見） `focus`（注目） `idea`（ひらめき） `question`（疑問） `surprise`（おどろき）。

alt / aria-label の文言は `data/ui/ja.json` の `characters.*`（例: 「シノブ（指さし）」「メガ（ひらめき）」）。

```tsx
<CharImage character="shinobu" pose="point" size="md" />
<CharImage character="kuro" reaction="thinking" size="sm" />
<CharacterReaction character="harada" effect="question" />            // idle 原画 + 疑問の記号
<CharacterReaction character="shinobu" pose="inspect" effect="focus" /> // 原画は選べる
```

- `size`（`sm` 96px / `md` 160px / `lg` 240px）を省略すると寸法クラスを付けないので、呼び出し側の CSS（例 `.case-mascot`）で決められる。
- `width/height` 属性には実寸（`src/data/characterSizes.ts`）が入る。表示サイズは CSS で指定する。
- 記号の位置は `placement`（`top-right` 既定 / `top-left`）、大きさは `--char-effect-width` で調整。
- 記号の出現演出は `prefers-reduced-motion` またはアプリ設定（`html[data-motion="reduced"]`）で止まり、最終状態を即時表示する。

## 禁止事項

- 顔・シルエットを再生成・再作画しない（`AGENTS.md`、C-2 正本）。`reactions/*.png` も「記号を重ねた補助状態」であり、表情差分の正式原画とは呼ばない。
- 無い組み合わせを作らない（メガ・クロ・ハラダの `point` 等）。画像を追加する場合はまず収録と人のレビューを通し、`assets.manifest.json` と `src/data/assets.ts` を更新する。
- 画面側で `assetUrl('characters/...')` を直接呼ばない。必ず `CharImage` / `CharacterReaction` を通す。
- 画像は配信物の実寸を超えて拡大表示しない（`lg` 240px まで）。

## どの画面でどの状態を使うか（提案）

| 画面 | 表示 | 状態 |
| --- | --- | --- |
| ホーム | `CharImage shinobu idle`（eager） | 待機 |
| 事件導入・ヘッダー | `CharImage shinobu idle`（`CaseHeader` で使用） | 待機 |
| 資料を開く・調べる | `CharacterReaction shinobu pose=inspect effect=focus` | 注目 |
| 証拠をリンクできた | `CharacterReaction shinobu effect=idea` | ひらめき |
| 数値の食い違いを見つけた | `CharacterReaction shinobu effect=conflict` | 矛盾 |
| 行き止まり・根拠不足 | `CharacterReaction shinobu effect=question` | 疑問 |
| 結果（掲載可） | `CharacterReaction harada effect=discovery` | 発見 |
| 結果（要再調査） | `CharImage harada reaction=worried` | 心配 |
| 図鑑の解説 | `CharImage mega pose=idle` / `CharacterReaction mega effect=idea` | 説明役 |
| チュートリアル | `CharImage kuro reaction=happy` など | 案内役 |

状態の割り当ては画面側 Issue で確定する。本書は組み合わせの上限を示すものであり、ここに無い画像を新たに作らない。
