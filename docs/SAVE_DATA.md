# セーブデータ形式と移行ポリシー

端末内保存（`localStorage`）の形式。実装は `src/state/migrations.ts`（純粋関数）と `src/state/persistence.ts`（storage 入出力）。

## 形式一覧

| version | キー | 内容 | 備考 |
| --- | --- | --- | --- |
| v0 | `paper-backside-mvp-v1` | `{ active, progress, finished }` | 試作 `prototype/app.js`。`version` 無し。各フィールドの型を保証していない。読み取りのみ |
| v1 | `urameku-mvp-v1` | `{ active, progress, finished }` | MVP-003。構造は v0 と同じ。`version` 無し |
| v2（現行） | `urameku-mvp-v1` | `{ version: 2, savedAt, active, progress, finished }` | `savedAt` は ISO 8601（UTC）。書き込みは常にこの形式 |

- `active: string` — 選択中の事件 ID。
- `progress: Record<caseId, CaseProgress>` — `src/domain/types.ts` の `CaseProgress`。`calculations` の値は文字列。
- `finished: Record<caseId, true>` — クリア済み事件。`true` 以外の値は読み捨てる。

v0 と v1 は中身だけでは区別できないため、読み出し元のキーで判定する（旧キー → v0、現行キー → v1）。

## 読み込みの流れ

1. 現行キー `STORAGE_KEY` を読む。あれば `JSON.parse` → `migrate(raw, { assumeVersion: 1 })`。
2. 無ければ `LEGACY_KEYS` を順に読む。あれば `migrate(raw, { assumeVersion: 0 })`。旧キーは削除しない（削除は MVP-031 の責務）。
3. どちらも無ければ初期値。

`migrate` は `{ data, migratedFrom, reset }` を返す。

| 入力 | 扱い |
| --- | --- |
| v0 / v1 | `migrations` 配列の各ステップを順に適用して v2 へ。`migratedFrom` = 元のバージョン |
| v2 | そのまま正規化。`migratedFrom: null` |
| JSON として壊れている / 配列 / プリミティブ / `version` が非整数・負 | 初期化。`reset: true` |
| `version` が現行より大きい（将来の形式。ロールバック時など） | 初期化せず、共通フィールド（`active` / `progress` / `finished`）の読めるものだけ拾う。`migratedFrom` = その値、`reset: false`。次回保存時に v2 で上書きされるため、未知のフィールドは失われる。本アプリはサーバ同期が無く未来形式に出会うのはロールバック時だけであり、進捗を消すより読める範囲を残す方を優先した |

`progress` の各エントリは必ず `normalizeProgress`（`src/domain/game.ts`）を通す。`finished` は `true` の項目だけ残す。

## 書き込み

`persistSaveData` は常に最新形式（`version: CURRENT_SAVE_VERSION`、`savedAt: 現在時刻`）で現行キーに書く。`setItem` が例外（`QuotaExceededError` など）を投げた場合は `false` を返し、例外を外へ出さない。

## 形式を変えるとき

1. `src/domain/types.ts` や `SaveData` を変更する。
2. `migrations.ts` の `migrations` 配列末尾に `{ from: N, to: N+1, up }` を追加し、`CURRENT_SAVE_VERSION` を N+1 にする。`up` は入力を信用せず、出力を to 形式として整形して返す。
3. `migrations.test.ts` に「vN → 最新」のケースを追加する。
4. この表に行を足す。
