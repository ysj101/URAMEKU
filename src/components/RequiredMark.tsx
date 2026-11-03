/**
 * 必須項目の印。ラベルや legend の文の横に置く。
 * 読み上げには `required` 属性で伝わるので、印そのものは読み上げない（ラベル名も変わらない）。
 */
export function RequiredMark() {
  return (
    <span className="required-mark" aria-hidden="true">
      ※必須
    </span>
  );
}

/** 足りない必須項目を、記録ボタンの近くに文字で示す（押せない理由） */
export function MissingList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="missing-list" role="status">
      記録するには、あと「{items.join('」「')}」が必要です。
    </p>
  );
}
