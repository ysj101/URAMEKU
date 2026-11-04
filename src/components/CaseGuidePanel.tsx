import { useEffect, useRef } from 'react';
import type { CaseData } from '../domain/types';

/**
 * ヘッダーの「⋯」メニューから開く「遊び方」。
 * 最初の事件では手順 4 つを示し、原則は CASE 00 と重なるので 2 段落にとどめる。
 */
export function CaseGuidePanel({ caseData, onClose }: { caseData: CaseData; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstDocument = caseData.documents[0];
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section className="v2-panel case-guide" aria-labelledby="case-guide-title">
      <h2 id="case-guide-title" ref={headingRef} tabIndex={-1}>
        遊び方
      </h2>
      {caseData.id === 'case-01' && (
        <section className="first-case-guide" aria-labelledby="first-case-guide-title">
          <h2 id="first-case-guide-title">最初の事件で、遊び方を体験しよう</h2>
          <ol>
            <li>資料を開いて読む。まずは「{firstDocument?.title}」から。</li>
            <li>問いの答えを選び、下に出る資料をすべて読む。答えは選ぶと記録されます。</li>
            <li>「証拠ボード」で文に証拠を添える。文の扱いを選び、「文と証拠を記録」を押す。</li>
            <li>残りを確かめたら、報告をまとめて提出する。提出すると答えと解説を確認できます。</li>
          </ol>
          <p>「根拠あり」「記録あり」は操作が済んだ印です。正解かどうかは提出後に分かります。</p>
        </section>
      )}
      <p>
        資料を読んで、主張がどこまで当てはまるか、情報がどこから出たのかを確かめましょう。反対のことを言う資料にも目を向けます。
      </p>
      <p>
        分からない点は分からないままにして整理できます。予算が足りなくなったら、メニューから最初からやり直せます。
      </p>
      <div className="stage-switch">
        <button type="button" className="btn ghost" onClick={onClose}>
          遊び方を閉じる
        </button>
      </div>
    </section>
  );
}
