# 端末内保存 — V2ゲームの互換性

ゲームのルール版 (`gameVersion: 2`)、事件の改訂 (`caseRevisions`)、保存形式 (`version: 4`) は別の値。キーは既存の `urameku-mvp-v1` を継続する。外部通信・認証・同期は追加しない。旧仕様の履歴は `archive/game-v1/SAVE_DATA.md`。

## 保存形式v4

- `version: 4`, `savedAt`: 形式の版とISO時刻。
- `gameVersion: 2`, `caseRevisions: Record<caseId, revision>`: 事件のルールと互換性。
- `active`, `progress`, `finished`: 現行の事件・途中状態・完了記録。
- `legacyProgress`, `legacyFinished`: 旧MVPの途中状態・完了。V2完了や図鑑へ自動転用しない。
- `archivedProgress`: `case-ID@旧revision` ごとの互換性のない途中記録。
- `session: {stage,lastDocumentId}`: 調査/報告の画面と最後の資料。
- `revision`: 書込ごとに増える競合解決番号。事件改訂とは別。
- `migrationNotice`: 旧記録を保管して再開した理由。画面に表示する。

`CaseProgress.v2` は解読の選択と根拠・任意メモ、複数リンク、実験の条件ID・初回反応・更新反応・比較理由・段階、意思決定の目的/方針/前提/支持/反証/理由の履歴、報告の主張/不確実性、順序付き操作履歴を保持する。初回判断と更新後の判断を上書きで混同しない。

## 旧形式と未来形式

| 入力 | 読込と保護 |
| --- | --- |
| 旧キー `paper-backside-mvp-v1` のv0、現行キーの版なしv1 | 旧ステップで整形後、旧記録をlegacyへ移す |
| 形式v2・v3 | 旧記録をlegacyへ保管、現行progress/finishedは空、調査画面から開始 |
| 形式v4 | 正規化し、事件のrevisionとID参照を確認して再開 |
| 不正JSON・解釈不能 | 安全な初期状態へ。容量超過/読込不可でもクラッシュしない |
| versionが4より大きい | 読める部分で一時的に操作できるが、**元の保存原文は一切上書きしない**。read-only表示を出す |

新しい事件改訂と合わないV2途中状態はarchivedProgressへ保管し、その事件だけを説明付きで再開始する。他の事件は保持する。matching revisionの復元では未読・存在しない資料、無効な条件/選択、段階を検証し、初回判断前の追加資料を開放しない。条件は事件IDによる固定割当を保存し、再読込・再挑戦で再抽選しない。

未来形式は内部 `readOnlyVersion` を持つ。`persistSaveData` はこれを拒否し、さらに書込直前にstorageのversionを読み、古いタブによる未来形式の破壊を防ぐ。未来形式を削除するのは設定から明示的な全削除を実行した場合のみ。

## 保存と競合

状態変更後150msのデバウンス、pagehide/beforeunload/アンマウント時の即時flushを継続。保存不可・容量超過は状態として伝え、画面上の進行は継続する。未知未来形式はfailedではなくread-onlyと表示し、削除に誘導しない。

他タブからの保存はrevision優先、同じならsavedAtの新しい側を採用し、取り込んだ内容を書き戻さない。未知未来形式の通知は保護優先で取り込む。`storage`削除通知は初期状態へ合わせる。同時編集の自動マージはなく、未保存変更が置換される既存制限は継続する。

## 削除

個別リセットはその事件の現行進捗・完了・legacy記録・archive記録・caseRevisionを消す。他事件の記録は保持。全削除はlocalStorage/sessionStorageの現行キー・旧キー・`urameku-`接頭辞のキーを対象にし、他アプリに触れない。IndexedDBは使わない。

## 検証

`src/state/v2Persistence.test.tsx` でv0〜v3移行、3方式の初回/更新後の再開、固定条件、改訂不整合、未来形式の原文保護、個別削除を検証。既存migrations/persistence/saveCoordinator/wipeテストで破損・容量超過・競合・全削除も確認する。ブラウザの再読込・戻る・途中保存はE2Eで別途確認する。
