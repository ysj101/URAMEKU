import { assetUrl } from '../data/assets';
import type { CaseData } from '../domain/types';

export function CaseHeader({ caseData }: { caseData: CaseData }) {
  return (
    <div className="case-header">
      <div>
        <span className="case-tag">{caseData.id.toUpperCase()} / FICTION</span>
        <h2>{caseData.title}</h2>
        <p>{caseData.intro}</p>
      </div>
      <img
        className="case-mascot"
        src={assetUrl('characters/shinobu/poses/idle.png')}
        alt="調査記者シノブ"
      />
    </div>
  );
}
