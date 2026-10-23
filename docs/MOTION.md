# 演出（モーション）ガイド（MVP-038）

`src/app/motion.css` に定義する軽量な CSS 演出と、`prefers-reduced-motion` / アプリ設定による無効化の仕組み。
組み込み先の画面側の変更は UI 系 Issue で行う（本 Issue はプリミティブの提供まで）。

## 原則

1. **1 操作 1 演出。** 1 回のタップで動くのは 1 要素まで。連鎖・同時多発させない。
2. **300ms 以下。** 時間は `tokens.css` の `--motion-fast`（120ms）/ `--motion-base`（200ms）/ `--motion-slow`（320ms・判子のみ）だけを使う。独自の時間を書かない。
3. **reduced 対応必須。** 新しい演出は必ず `motion.css` のクラスとして追加する。クラスにしておけば末尾の reduced ブロックで自動的に止まる。JS で演出の有無を分岐するときは `useReducedMotion()` を使い、reduced 時は最終状態を即時表示する。`animationend` を待つ処理は reduced 時に呼ばれないので、即時に進める分岐を必ず書く（`Stamp` の `onSettled` を参照）。
4. **動かすのは `transform` と `opacity` だけ。** `width` / `height` / `margin` / `top` などレイアウトを動かさない（リフローを起こさない）。
5. **`will-change` は演出中だけ。** `is-animating` クラスにのみ付け、`animationend` で外す。常時付けない。
6. **`box-shadow` の多重・`filter` を使わない。** 影は `--shadow-paper*`（ぼかし無しのオフセット影 1 枚）のみ。`filter: blur()` / `drop-shadow()` / `backdrop-filter` は紙テクスチャの repeat 背景の上で高コストになるため禁止。
7. **背景画像はこの Issue で触らない。** `newsprint.svg` / `desk.svg` の repeat 背景の最適化は MVP-043。
8. **色は書かない。** 演出 CSS でも生の色コードは使わず、必要なら `tokens.css` のトークンを参照する。

## モーショントークン（`tokens.css`）

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--motion-fast` / `-base` / `-slow` | 120 / 200 / 320ms | ピン / めくり・カード / 判子 |
| `--motion-ease` | cubic-bezier(0.2, 0, 0, 1) | 通常の減速 |
| `--motion-ease-settle` | cubic-bezier(0.34, 1.3, 0.64, 1) | 判子・ピンが「ぱたん」と収まる（軽いオーバーシュート） |
| `--motion-lift` | 8px | 紙片が置かれるときの浮き |
| `--motion-tilt` | 1.5deg | 紙片の置きズレ |
| `--motion-stamp-tilt` | -6deg | 判子の最終傾き（演出なしでも適用） |
| `--motion-stamp-scale` | 1.35 | 判子を押す直前の拡大 |
| `--motion-pin-drop` | 10px | ピンの落下距離 |

reduced 時は `--motion-fast/base/slow` が `0.01ms` に上書きされる。

## クラス一覧（`motion.css`）

| クラス | 演出 | 時間 | 想定する組み込み先 |
| --- | --- | --- | --- |
| `.motion-page-turn` | 紙をめくる（左端を軸に軽く rotateY + フェード） | base | 資料ダイアログ（`DocumentDialog`）の開封、記事プレビュー |
| `.motion-stamp-press` | 判子を押す（拡大 → 押し込み → 収まる） | slow | 結果画面の「掲載可 / 要再調査 / 特ダネ」、記事作成の DRAFT |
| `.motion-pin-drop` | ピンを刺す（上から落ちて縮む） | fast | 証拠ボード（`EvidenceBoard`）のピン留め |
| `.motion-card-place` | カードが置かれる（下から浮いて傾きが戻る） | base | 資料タイル・通知・記事断片の出現 |
| `.is-animating` | 上記と併用。演出中だけ `will-change` を付ける | - | コンポーネントが `animationend` で外す |

静的スタイル（`global.css` を変えないためここに置く）:

| クラス | 内容 |
| --- | --- |
| `.paper-card` / `--aged` / `--note` | 紙片の共通ラッパー（紙白 / 古紙 / メモ用紙） |
| `.stamp` | 判子画像。`--stamp-width`（既定 160px）で幅を指定。最終傾き付き |

## コンポーネント

### `Stamp`（`src/components/Stamp.tsx`）

```tsx
<Stamp kind="accepted" onSettled={() => playSe('stamp')} />
```

- `kind`（`StampKind`・`src/components/stampAssets.ts`）: `accepted`（掲載可）/ `rejected`（要再調査）/ `draft`（DRAFT）/ `perfect`（特ダネ）/ `verified`（CHECKED）/ `confidential`（社外秘）。`public/assets/ui/stamps/*.svg` に実在するものだけ。
- `animate`（既定 true）: false で押下演出なし（すでに押された判子の再表示）。
- `onSettled`: 演出終了時に 1 回。reduced または `animate=false` のときはマウント直後に呼ぶ。
- `data-animated="true|false"`、`data-stamp="<kind>"` を出力する（テスト・CSS 用）。

### `PaperCard`（`src/components/PaperCard.tsx`）

```tsx
<PaperCard enter="page" tone="note">...</PaperCard>
```

- `enter`: `place`（既定）/ `page` / `none`。
- `tone`: `white`（既定）/ `aged` / `note`。
- `div` の属性をそのまま受け取る。`data-animated` を出力する。

## Reduced Motion の仕組み

判定は次の 2 条件の OR（どちらかが真なら演出を減らす）。

| 条件 | 由来 | 見る側 |
| --- | --- | --- |
| `@media (prefers-reduced-motion: reduce)` | OS 設定 | `motion.css` / `useReducedMotion` |
| `<html data-motion="reduced">` | アプリ設定（`motionSettings.ts`） | `motion.css` / `useReducedMotion` |

どちらの場合も `motion.css` 末尾のブロックで全要素の `animation: none` と `transition-duration: 0.01ms` を適用し、状態変化は即時表示になる。

### アプリ設定（`src/app/motionSettings.ts`）

- 保存キー: `localStorage['urameku-motion']`。値は `'reduced'` のみ保存し、`'system'`（既定）はキーを削除する。
- `StorageLike` を注入できる（MVP-029 の `persistence.ts` と同じ型）。読み書きの失敗は握りつぶして `'system'` にフォールバックする。
- API: `loadMotionPreference` / `saveMotionPreference` / `applyMotionPreference` / `setMotionPreference`（保存+反映） / `initMotionPreference`（起動時）。
- **未組み込み:** 起動時の `initMotionPreference()` 呼び出しと設定 UI（トグル）は UI 系 Issue で `App.tsx` 側に入れる。それまでアプリ設定は手動で `document.documentElement.dataset.motion = 'reduced'` とすることで確認できる。

### フック（`src/app/useReducedMotion.ts`）

`useSyncExternalStore` で `matchMedia` の `change` と `data-motion` 属性の `MutationObserver` を購読し、boolean を返す。`matchMedia` が無い環境（jsdom / SSR）では属性だけを見る。同期判定が必要なら `readReducedMotion()`。

## 確認方法

- macOS: システム設定 → アクセシビリティ → ディスプレイ → 「視差効果を減らす」。Chrome DevTools: Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`。
- 期待: 判子・カード・ピン・めくりがすべて即時表示になり、`img.stamp` の `data-animated` が `false` になる。
- 自動テスト: `src/app/useReducedMotion.test.tsx`、`src/app/motionSettings.test.ts`、`src/components/Stamp.test.tsx`、`src/components/PaperCard.test.tsx`。
