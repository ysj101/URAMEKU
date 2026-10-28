import type { CaseData } from '../domain/types';
import { CharImage } from './CharImage';

/** 事件の見出し。番号と題名を 1 行に圧縮し、何を調査しているかが分かるよう概要は常に出す */
export function CaseHeader({ caseData }: { caseData: CaseData }) {
  return (
    <div className="case-header">
      <div className="case-header__body">
        <div className="case-header__row">
          <span className="case-tag">{caseData.id.toUpperCase()} / FICTION</span>
          <h1 id="case-title">{caseData.title}</h1>
        </div>
        <p className="case-header__intro">{caseData.intro}</p>
      </div>
      <CharImage character="shinobu" pose="idle" className="case-mascot" loading="eager" />
    </div>
  );
}
