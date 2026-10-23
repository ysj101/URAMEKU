import {
  assetUrl,
  ENCYCLOPEDIA_IDS,
  encyclopediaArt,
  uiIllustration,
  type EncyclopediaId,
} from '../data/assets';
import type { EncyclopediaEntry } from '../data/encyclopedia';

/** 図鑑項目の絵。収録済み ID はヘルパー経由、それ以外は JSON の `art` を相対パスとして解決する */
export function entryArtUrl(entry: Pick<EncyclopediaEntry, 'id' | 'art'>): string {
  return (ENCYCLOPEDIA_IDS as readonly string[]).includes(entry.id)
    ? encyclopediaArt(entry.id as EncyclopediaId)
    : assetUrl(entry.art);
}

/** 「CASE 03」のような表示用番号。事件一覧に無い ID なら null */
export function caseLabel(caseNumber: number | null): string | null {
  return caseNumber === null ? null : `CASE ${String(caseNumber).padStart(2, '0')}`;
}

export interface EncyclopediaCardProps {
  entry: EncyclopediaEntry;
  /** 解放済み（対応する事件に合格済み）か */
  unlocked: boolean;
  /** 解放条件となる事件の表示番号（1 始まり）。事件一覧に無ければ null */
  caseNumber: number | null;
}

/**
 * 図鑑の 1 項目。
 * - 解放済み: 絵・題名・要約・注記（`disclaimer`）をすべて出す
 * - 未解放: 鍵のイラストと「CASE NN を解決すると追加」だけ。概念名は一切出さない
 */
export function EncyclopediaCard({ entry, unlocked, caseNumber }: EncyclopediaCardProps) {
  if (!unlocked) {
    const label = caseLabel(caseNumber);
    return (
      <li className="encyclopedia-card locked" data-entry-state="locked">
        <img className="encyclopedia-card-art" src={uiIllustration('locked')} alt="" />
        <p className="encyclopedia-card-locked">
          {label ? `${label} を解決すると追加` : '事件を解決すると追加'}
        </p>
      </li>
    );
  }
  return (
    <li className="encyclopedia-card" data-entry-state="unlocked">
      <img className="encyclopedia-card-art" src={entryArtUrl(entry)} alt="" />
      <div className="encyclopedia-card-body">
        <h3 className="encyclopedia-card-title">{entry.title}</h3>
        <p className="encyclopedia-card-summary">{entry.summary}</p>
        <p className="encyclopedia-card-disclaimer">{entry.disclaimer}</p>
      </div>
    </li>
  );
}
