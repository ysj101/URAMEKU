import { assetUrl } from '../data/assets';
import type { CaseData } from '../domain/types';
import '../app/screens/visual-case-guide.css';

/** Facts and copy come from case JSON; the illustration never carries essential labels. */
export function VisualCaseGuide({ caseData }: { caseData: CaseData }) {
  const guide = caseData.debrief.visualGuide;
  if (!guide) return null;
  const sources = (ids: string[]) =>
    ids.map((id) => caseData.documents.find((doc) => doc.id === id)?.title ?? id).join('・');
  return (
    <div className="case-guide">
      <div className="case-guide-opening">
        <div>
          <h3>{guide.title}</h3>
          <p>{guide.intro}</p>
        </div>
        <a
          className="case-guide-image"
          href={assetUrl(guide.image)}
          target="_blank"
          rel="noreferrer"
        >
          <img src={assetUrl(guide.image)} alt={guide.imageAlt} width="1536" height="1024" />
          <span>図を大きく見る（別タブ）</span>
        </a>
      </div>
      <details className="case-guide-details">
        <summary>図の内容と根拠を読む</summary>
        {guide.panels && (
          <div className="case-guide-facts">
            {guide.panels.map((panel) => (
              <section key={panel.title}>
                <h4>{panel.title}</h4>
                <p>{panel.body}</p>
                <small className="case-guide-source">{sources(panel.evidence)}</small>
              </section>
            ))}
          </div>
        )}
        {guide.steps && (
          <ol className="case-guide-flow" aria-label="資料で追う人数の変化">
            {guide.steps.map((step) => (
              <li key={step.label}>
                <span>{step.label}</span>
                <strong>
                  {step.count}
                  <small>人</small>
                </strong>
                <p>{step.note}</p>
                <small className="case-guide-source">{sources(step.evidence)}</small>
              </li>
            ))}
          </ol>
        )}
        {guide.comparisons && (
          <div className="case-guide-comparisons" aria-label="もとにする人数で変わる割合">
            {guide.comparisons.map((item) => (
              <section key={item.label}>
                <h4>{item.label}</h4>
                <p className="case-guide-equation">
                  <span>
                    {item.numerator}人 ÷ {item.denominator}人
                  </span>
                  <span>
                    ＝{' '}
                    <strong>
                      {item.percent}
                      <small>%</small>
                    </strong>
                  </span>
                </p>
                <div className="case-guide-bar" aria-hidden="true">
                  <span style={{ width: `${item.percent}%` }} />
                </div>
                <small className="case-guide-source">{sources(item.evidence)}</small>
              </section>
            ))}
          </div>
        )}
      </details>
      <p className="case-guide-conclusion">{guide.conclusion}</p>
      <aside className="case-guide-limit">
        <h4>まだ分からないこと</h4>
        <p>{guide.limit}</p>
      </aside>
      <p className="case-guide-takeaway">{guide.takeaway}</p>
    </div>
  );
}
