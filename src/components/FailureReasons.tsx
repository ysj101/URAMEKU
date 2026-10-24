import type { FailureReason } from '../domain/scoring';

/**
 * 差し戻し理由。不足している系統だけを列挙する。
 * 理由が無い（掲載承認）ときは何も描画しない。
 */
export function FailureReasons({ reasons }: { reasons: FailureReason[] }) {
  if (reasons.length === 0) return null;
  return (
    <div className="failure-reasons">
      <strong>差し戻しの理由</strong>
      <ul role="list" aria-label="差し戻しの理由">
        {reasons.map((r) => (
          <li key={r.track} data-track={r.track}>
            {r.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
