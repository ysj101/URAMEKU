# デザイントークン（C-2 / MVP-019）

`src/app/tokens.css` の `:root` で定義する CSS カスタムプロパティの一覧と使用ルール。
値は試作版 `global.css` の見た目をそのまま引き継いでいる（本 Issue では色を変更していない）。

## 使用ルール

- コンポーネント・画面の CSS では **生の色コード（`#xxxxxx`・`white` など）、影、フォーカス指定を書かない**。必ず用途トークン（`--color-*`, `--focus-ring-*`, `--shadow-*`）を参照する。
- `--palette-*` は原色。コンポーネントから直接参照せず、用途トークン経由で使う。
- 新しい用途が必要なら、既存の用途トークンで表現できないか確認してから `tokens.css` に追加し、この表を更新する。
- 確認コマンド: `grep -nE '#[0-9a-fA-F]{3,6}' src/app/*.css` の結果が `tokens.css` だけであること。
- ダークモードは MVP 範囲外。対応時は `tokens.css` 末尾のコメントどおり、用途トークンのみを `prefers-color-scheme: dark` で上書きする。
- `prefers-reduced-motion` の扱いは MVP-038。ここでは時間トークンのみ定義する。
- 読み込み順: `src/main.tsx` で `tokens.css` → `global.css` の順に import する。

## 色（用途）

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--color-bg` | `#f5f0e5` | ページ背景（新聞紙） |
| `--color-surface` | `#fffaf0` | 紙白：カード・ダイアログ・入力欄 |
| `--color-surface-aged` | `#e8dabd` | 古紙：情報パネル・見出しピース |
| `--color-surface-smudge` | `#dbd4c7` | 擦れた紙（予備） |
| `--color-surface-desk` | `#ddd3c1` | 捜査デスク天板 |
| `--color-surface-note` | `#fff5d7` | メモ用紙：通知・リンク枠・計算デスク |
| `--color-surface-explain` | `#efe7d9` | 結果画面の解説欄 |
| `--color-ink` | `#242426` | 本文・罫線・影 |
| `--color-ink-inverse` | `#ffffff` | 濃色地（インク・赤・青）の上の文字 |
| `--color-quiet` | `#746f68` | 補足・注記・無効説明 |
| `--color-border` | `#aaa192` | 細い罫線（脚注の区切り） |
| `--color-border-dashed` | `#8f8b83` | 破線枠 |
| `--color-accent` | `#cf4b4b` | 強調（赤）：主ボタン・タグ・選択枠・成績 |
| `--color-info` | `#487d93` | 情報（青）：副ボタン・通知の罫・フォーカス |
| `--color-success` | `#3f7a4e` | 成功（試作未使用。将来の正解表示用） |
| `--color-warning` | `#f5ce6c` | 警告・予算残（暗地の上） |
| `--color-disabled` | `#8f8b83` | 無効状態の文字・枠 |
| `--color-backdrop` | `#1e2021b0` | ダイアログ暗幕 |
| `--opacity-disabled` | `0.42` | 無効ボタン |
| `--opacity-muted` | `0.5` | 使用済みピン |

## フォーカスリング

| トークン | 値 |
| --- | --- |
| `--focus-ring-color` | `var(--color-info)` |
| `--focus-ring-width` | `3px` |
| `--focus-ring-offset` | `3px` |

## タイポグラフィ

| トークン | 値 | 用途 |
| --- | --- | --- |
| `--font-sans` | system-ui, -apple-system, Hiragino Kaku Gothic ProN, Noto Sans JP, sans-serif | 本文 |
| `--font-serif` | Georgia, serif | 見出し・成績 |
| `--font-size-xs` / `-sm` / `-md` / `-base` | 0.7 / 0.8 / 0.85 / 1rem | ラベル / 注記 / 小本文 / 本文 |
| `--font-size-lg` / `-xl` / `-2xl` / `-display` | 1.2 / 1.6 / 2 / 5rem | 節見出し / 結果見出し / ダイアログ見出し / 成績 |
| `--line-height-tight` 〜 `-loose` | 1 / 1.45 / 1.7 / 1.8 / 2 | 見出し〜長文 |

試作由来の端数サイズ（0.69rem, 0.73rem など）はビジュアル回帰を避けるため `global.css` に残している。新規コンポーネントはスケール上の値を使う。

## スペーシング・角丸・影・罫線

| トークン | 値 |
| --- | --- |
| `--space-1` 〜 `--space-12` | 4, 8, 12, 16, 20, 24, 32, 40, 48px |
| `--radius-none` / `-sm` / `-md` | 0 / 2px / 4px（切り抜き紙なので基本は角のまま） |
| `--shadow-paper-sm` / `--shadow-paper` / `--shadow-paper-lg` | 2px 2px / 3px 3px / 8px 9px の `--color-ink` オフセット影（ぼかしなし） |
| `--border-width-thin` / `--border-width` / `--border-width-thick` | 1px / 2px / 3px |
| `--tap-target-min` | 44px |

## z-index・モーション

| トークン | 値 |
| --- | --- |
| `--z-base` / `-raised` / `-skip-link` / `-overlay` / `-dialog` / `-toast` | 0 / 1 / 10 / 100 / 200 / 300 |
| `--motion-fast` / `-base` / `-slow` | 120ms / 200ms / 320ms |
| `--motion-ease` | cubic-bezier(0.2, 0, 0, 1) |

## コントラスト比（WCAG 2.x 相対輝度で算出）

主要な組み合わせ。4.5:1 以上が通常文字の AA。3:1 以上は大きい文字（18pt / 太字 14pt 以上）と UI 部品の境界なら AA。

| 前景 | 背景 | 比率 | 判定 |
| --- | --- | --- | --- |
| `--color-ink` | `--color-bg` / `--color-surface` / `--color-surface-aged` / `-note` / `-desk` / `-explain` | 13.6 / 14.9 / 11.2 / 14.2 / 10.5 / 12.6 | OK |
| `--color-ink-inverse` | `--color-ink` | 15.5 | OK |
| `--color-ink-inverse` | `--color-info` | 4.54 | OK |
| `--color-warning` | `--color-ink` | 10.3 | OK |
| `--color-quiet` | `--color-surface` / `--color-surface-note` | 4.79 / 4.58 | OK |
| `--color-success` | `--color-surface` / `--color-bg` | 4.92 / 4.50 | OK |
| **`--color-quiet`** | **`--color-bg`** | **4.38** | 4.5 未満（脚注 0.72rem の通常文字） |
| **`--color-quiet`** | **`--color-surface-aged`** | **3.60** | 4.5 未満（情報パネル内の注記） |
| **`--color-ink-inverse`** | **`--color-accent`** | **4.41** | 4.5 未満（主ボタン・タグ・h1 の帯。太字 0.7rem〜） |
| **`--color-accent`** | `--color-surface` / `--color-bg` / `--color-surface-aged` | **4.24 / 3.88 / 3.19** | 4.5 未満（案件番号・ピン強調。成績 5rem は大文字扱いで OK） |
| **`--color-info`** | `--color-surface` / `--color-bg` | **4.36 / 3.99** | 4.5 未満（文字としては未使用。フォーカスリングは UI 部品の 3:1 を満たす） |
| `--color-border` | `--color-bg` | 2.25 | 装飾的な罫線のみ。文字・部品境界に使わない |
| `--color-border-dashed` | `--color-surface-note` | 3.12 | UI 部品の境界として OK |

### 変更提案（本 Issue では適用しない）

色の変更はアートディレクションの判断が必要なため、本 Issue では値を変えず提案のみ記録する。

- `--color-quiet`: `#746f68` → `#6c675f` にすると紙上 4.94、古紙上 4.06。古紙上でも 4.5 を満たすには `#67625b`（4.37）でも不足するため、情報パネル内は `--color-ink` を使う運用が現実的。
- `--color-accent`: `#cf4b4b` → `#c43f3f` にすると白文字 5.08、紙白上 4.89。`#bf3a3a` なら紙上 4.76。
- `--color-info`: `#487d93` → `#3f7389` にすると紙上 4.59、紙白上 5.01、白文字 5.22。
- 赤・青を文字色として小さく使う箇所（案件番号 0.7rem など）は太字のまま 0.875rem 以上にするか、`--color-ink` に寄せる。

## 参考

- `docs/ART_BIBLE.md` に記載の参考色（インク `#242322`、紙 `#F5F0E6`、赤 `#D44843`、青 `#437A92` など）と試作 `global.css` の値はわずかに異なる。本 Issue は見た目を変えないため試作値を採用した。どちらに揃えるかはアート QA で決め、`tokens.css` の `--palette-*` のみを更新すれば全画面に反映される。
