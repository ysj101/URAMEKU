import type { CaseData } from '../domain/types';
import { CharImage } from './CharImage';

interface Props {
  caseData: CaseData;
  /** 事件の概要（intro）を開いた状態で出すか。初回は開き、調査が進んだら畳む */
  introOpen?: boolean;
}

/** 事件の見出し。1 行に圧縮し、概要は折りたたみで場所を取らない */
export function CaseHeader({ caseData, introOpen = true }: Props) {
  return (
    <div className="case-header">
      <div className="case-header__body">
        <div className="case-header__row">
          <span className="case-tag">{caseData.id.toUpperCase()} / FICTION</span>
          <h1 id="case-title">{caseData.title}</h1>
        </div>
        <details className="case-header__intro" open={introOpen}>
          <summary>事件の概要</summary>
          <p>{caseData.intro}</p>
        </details>
      </div>
      <CharImage character="shinobu" pose="idle" className="case-mascot" loading="eager" />
    </div>
  );
}
