import type { CaseData } from '../domain/types';
import { CharImage } from './CharImage';

export function CaseHeader({ caseData }: { caseData: CaseData }) {
  return (
    <div className="case-header">
      <div>
        <span className="case-tag">{caseData.id.toUpperCase()} / FICTION</span>
        <h2>{caseData.title}</h2>
        <p>{caseData.intro}</p>
      </div>
      <CharImage character="shinobu" pose="idle" className="case-mascot" loading="eager" />
    </div>
  );
}
