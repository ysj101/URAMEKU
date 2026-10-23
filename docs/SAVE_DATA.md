# セーブデータ形式と移行ポリシー

端末内保存（`localStorage`）の形式。実装は `src/state/migrations.ts`（純粋関数）と `src/state/persistence.ts`（storage 入出力）。

## 形式一覧

| version | キー | 内容 | 備考 |
| --- | --- | --- | --- |
| v0 | `paper-backside-mvp-v1` | `{ active, progress, finished }` | 試作 `prototype/app.js`。`version` 無し。各フィールドの型を保証していない。読み取りのみ |
| v1 | `urameku-mvp-v1` | `{ active, progress, finished }` | MVP-003。構造は v0 と同じ。`version` 無し |
| v2 | `urameku-mvp-v1` | `{ version: 2, savedAt, active, progress, finished }` | `savedAt` は ISO 8601（UTC） |
| v3（現行） | `urameku-mvp-v1` | `{ version: 3, savedAt, revision, active, progress, finished, session }` | MVP-030。途中状態と競合判定用の番号を追加。書き込みは常にこの形式 |

- `active: string` — 選択中の事件 ID。
- `progress: Record<caseId, CaseProgress>` — `src/domain/types.ts` の `CaseProgress`。`calculations` の値は文字列。
- `finished: Record<caseId, true>` — クリア済み事件。`true` 以外の値は読み捨てる。
- `session: { stage, lastDocumentId }` — 事件途中の UI 状態（v3）。
  - `stage: 'investigate' | 'article'` — 再起動後に開く画面。それ以外の値は `'investigate'`。
  - `lastDocumentId: string | null` — 選択中の事件で最後に開いた資料 ID。空文字・非文字列は `null`。読み込み時に事件に存在しない ID なら `null` に落とす。
  - 事件の切り替え・`reset`・`resetAll` で初期値（調査画面・`null`）に戻る。
- `revision: number` — 保存のたびに 1 増える非負整数（v3）。複数タブの競合判定に使う（後述）。不正値は 0。

v0 と v1 は中身だけでは区別できないため、読み出し元のキーで判定する（旧キー → v0、現行キー → v1）。

## 読み込みの流れ

1. 現行キー `STORAGE_KEY` を読む。あれば `JSON.parse` → `migrate(raw, { assumeVersion: 1 })`。
2. 無ければ `LEGACY_KEYS` を順に読む。あれば `migrate(raw, { assumeVersion: 0 })`。旧キーは削除しない（削除は MVP-031 の責務）。
3. どちらも無ければ初期値。

`migrate` は `{ data, migratedFrom, reset }` を返す。

| 入力 | 扱い |
| --- | --- |
| v0 / v1 / v2 | `migrations` 配列の各ステップを順に適用して v3 へ。`migratedFrom` = 元のバージョン。v2 → v3 では `session` を初期値（調査画面）、`revision` を 0 にする |
| v3 | そのまま正規化。`migratedFrom: null` |
| JSON として壊れている / 配列 / プリミティブ / `version` が非整数・負 | 初期化。`reset: true` |
| `version` が現行より大きい（将来の形式。ロールバック時など） | 初期化せず、共通フィールド（`active` / `progress` / `finished`）の読めるものだけ拾う。`migratedFrom` = その値、`reset: false`。次回保存時に v3 で上書きされるため、未知のフィールドは失われる。本アプリはサーバ同期が無く未来形式に出会うのはロールバック時だけであり、進捗を消すより読める範囲を残す方を優先した |

`progress` の各エントリは必ず `normalizeProgress`（`src/domain/game.ts`）を通す。`finished` は `true` の項目だけ残す。

## 書き込み

`persistSaveData` は常に最新形式（`version: CURRENT_SAVE_VERSION`、`savedAt: 現在時刻`）で現行キーに書く。`setItem` が例外（`QuotaExceededError` など）を投げた場合は `false` を返し、例外を外へ出さない。

### タイミング（`useGame`）

- state の変更ごとに `revision` を 1 増やし、**150ms のデバウンス**（`SAVE_DEBOUNCE_MS`）後に 1 回だけ書く。計算欄の連続入力などで毎回 `setItem` しない。
- `pagehide` / `beforeunload` と `useGame` のアンマウント時は待たずに即時フラッシュする。
- `revision` が最後に書いた（または他タブから取り込んだ）値と同じなら書かない。

### 保存状態（`GameApi.saveStatus`）

| 値 | 意味 |
| --- | --- |
| `saved` | 最後の書き込みが成功した（または未保存の変更が無い） |
| `failed` | 書き込みが失敗した（容量超過など）。画面上の進行は続くが端末には残らない。次の書き込みが成功すれば `saved` に戻る |
| `unavailable` | `localStorage` が使えない環境（プライベートモード、アクセスで例外が出る等） |

表示は MVP-028 の責務。ここでは値の提供まで。

## 競合処理（複数タブ）

同じブラウザで複数タブを開いて遊ぶと、同じキーに両方のタブが書く。実装は `src/state/saveCoordinator.ts`（純粋関数）と `useGame` の `storage` イベント購読。

ポリシー: **最後に保存した側が勝ち、他タブはそれを取り込む（take-remote）**。

1. 各タブは保存のたびに `revision` を進める。他タブの保存を取り込んだら、その `revision` と `savedAt` を引き継ぐ。
2. 他タブの書き込みは `window` の `storage` イベントで検知する（自タブの書き込みでは発火しない）。`key` が現行キー以外なら無視する。
3. `resolveConflict(local, remote)` で判定する。
   - `remote.revision > local.revision` → `take-remote`。自タブの state を他タブの保存で丸ごと置き換える（画面段階も含む）。取り込んだ内容は書き戻さない。
   - `remote.revision < local.revision` → `keep-local`。古い保存は無視する（自タブの次の保存で上書きされる）。
   - 同じ `revision` → `savedAt` が新しい方。これも同じなら `keep-local`。
   - `revision` を `savedAt` より優先するのは、端末時計のずれに影響されないため。
4. `newValue` が `null`（他タブの `resetAll` / `clear`）→ 自タブも初期状態に合わせる。
5. `newValue` が壊れている・解釈不能 → 無視する（他タブの壊れた保存で自タブを初期化しない）。

既知の制限: 取り込む側のタブに未保存（デバウンス中）の変更があれば、それは捨てられる。同じ `revision` から両タブが同時に変更した場合は `savedAt` の遅い方に収束する。サーバ同期は無いので、ここでのマージは行わない。

## 形式を変えるとき

1. `src/domain/types.ts` や `SaveData`（`src/state/migrations.ts`）を変更する。
2. `migrations.ts` の `migrations` 配列末尾に `{ from: N, to: N+1, up }` を追加し、`CURRENT_SAVE_VERSION` を N+1 にする。`up` は入力を信用せず、出力を to 形式として整形して返す。
3. `migrations.test.ts` に「vN → 最新」のケースを追加する。
4. この表に行を足す。

## 削除（MVP-031）

実装は `src/state/wipe.ts`。UI は `src/components/ResetProgressPanel.tsx`（2 段階確認）と `src/screens/SettingsScreen.tsx`。

### 対象

Web Storage（`localStorage` と `sessionStorage`）の次のキーをすべて消す。

| 対象 | 例 |
| --- | --- |
| 現行キー `STORAGE_KEY` | `urameku-mvp-v1` |
| 旧キー `LEGACY_KEYS`（読み取り専用だったもの） | `paper-backside-mvp-v1` |
| 接頭辞 `STORAGE_KEY_PREFIX`（`urameku-`）で始まるキー | 将来の設定キーなど |

アプリが新しくキーを作るときは必ず `urameku-` で始める。そうすれば `wipe.ts` を変えずに削除対象に含まれる。他アプリのキー（接頭辞が異なるもの）には触れない。

**対象外**: IndexedDB / Cache Storage は MVP では使っていない。PWA の Service Worker キャッシュは MVP-045 以降で扱う。

### API

| 関数 | 役割 |
| --- | --- |
| `wipeAllLocalData({ local?, session? })` | 両 storage からアプリのキーを削除し `{ removed, remaining }` を返す。引数省略時は実際の `localStorage` / `sessionStorage` |
| `wipeStorage(storage)` | 1 つの storage から削除。削除したキーを返す |
| `verifyWiped(storage)` | 削除後に残っているアプリのキーを返す。空配列なら完全に消えている |
| `listAppKeys(storage)` / `isAppKey(key)` | 列挙・判定。`key()` を持たない storage では既知のキーだけ見る |
| `resetCaseProgress(save, caseId)` | 純粋関数。指定した事件の `progress` と `finished` だけを消し、他の事件と `active` は変えない |

`persistence.ts` の `clearSaveData` は `wipeStorage` に委譲しており、現行キーだけでなく旧キーも消える。

### UI の流れ

1. 「この事件をやり直す」または「この端末の記録をすべて削除」を押す。
2. 確認文（`role="alertdialog"`）と「削除する」/「やめる」が出る。`window.confirm` は使わない。
3. 「削除する」で実行し、完了を `role="status"` で表示する。「やめる」なら何もしない。
