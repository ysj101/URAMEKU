/**
 * 複数タブ間の保存競合の判定（純粋関数。storage や React には触らない）。
 *
 * ポリシー（docs/SAVE_DATA.md「競合処理」）:
 * - 各タブは保存のたびに `revision` を 1 増やす。他タブの保存を取り込んだら、その revision を引き継ぐ。
 * - 他タブの保存を `storage` イベントで検知したら `resolveConflict(local, remote)` で判定し、
 *   `take-remote` なら自タブの state を丸ごと置き換える（最後に保存した側が勝つ）。
 *   `keep-local` なら何もしない（古い保存は無視。自タブの次の保存で上書きされる）。
 * - 新旧は `revision` で判定し、同じ revision のときだけ `savedAt` で判定する
 *   （時計のずれに影響されにくい順序を優先する）。それでも同じなら自タブを保つ。
 */

export interface SaveStamp {
  revision: number;
  /** ISO 8601。無い・不正なら 0 とみなす */
  savedAt?: string | null;
}

export type ConflictResolution = 'keep-local' | 'take-remote';

export type SaveOrder = 'local-newer' | 'remote-newer' | 'same';

function parseTime(savedAt: string | null | undefined): number {
  if (typeof savedAt !== 'string') return 0;
  const t = Date.parse(savedAt);
  return Number.isFinite(t) ? t : 0;
}

/** どちらが新しいかを返す。`revision` 優先、同点なら `savedAt`。 */
export function compareSaves(local: SaveStamp, remote: SaveStamp): SaveOrder {
  if (remote.revision !== local.revision) {
    return remote.revision > local.revision ? 'remote-newer' : 'local-newer';
  }
  const lt = parseTime(local.savedAt);
  const rt = parseTime(remote.savedAt);
  if (rt === lt) return 'same';
  return rt > lt ? 'remote-newer' : 'local-newer';
}

/** 他タブの保存（remote）を取り込むべきか。新しいときだけ取り込み、同じ・古いときは自タブを保つ。 */
export function resolveConflict(local: SaveStamp, remote: SaveStamp): ConflictResolution {
  return compareSaves(local, remote) === 'remote-newer' ? 'take-remote' : 'keep-local';
}

/** 次に書き込む revision。他タブの保存を取り込んだ直後でも、その値より必ず大きくなる。 */
export function nextRevision(current: number): number {
  return Number.isInteger(current) && current >= 0 ? current + 1 : 1;
}
