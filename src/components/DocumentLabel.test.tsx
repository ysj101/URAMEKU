import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROP_NAMES } from '../data/assets';
import { DOCUMENT_VISUALS } from '../data/validateCase';
import { CASES } from '../data/cases';
import { DocumentLabel } from './DocumentLabel';
import { VISUAL_LABEL, VISUAL_PROP, formatCaseId, formatDocumentNumber } from './documentVisuals';

const ROOT = resolve(__dirname, '../..');

describe('DocumentLabel', () => {
  it('事件 ID・資料番号・資料 ID・種別・コストを HTML テキストで表示する', () => {
    const { container } = render(
      <DocumentLabel caseId="case-01" index={2} documentId="trial" visual="ledger" cost={1} />,
    );
    const label = container.querySelector('.document-label');
    expect(label).toHaveTextContent('CASE 01');
    expect(label).toHaveTextContent('資料 02');
    expect(label).toHaveTextContent('（trial）');
    expect(label).toHaveTextContent('台帳');
    expect(label).toHaveTextContent('コスト 1');
    expect(label).toHaveAttribute('data-case', 'case-01');
    expect(label).toHaveAttribute('data-document', 'trial');
    expect(label).toHaveAttribute('data-visual', 'ledger');
  });

  it('コスト 0 は「無料」と表示する', () => {
    render(<DocumentLabel caseId="case-01" index={1} documentId="ad" visual="advert" cost={0} />);
    expect(screen.getByText('無料')).toBeInTheDocument();
  });

  it('種別アイコンは実在する props の SVG を参照し、読み上げ対象にしない', () => {
    const { container } = render(
      <DocumentLabel caseId="case-03" index={6} documentId="comments" visual="news" cost={1} />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/assets/props/news.svg');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('hideIcon のときはテキストのみ', () => {
    const { container } = render(
      <DocumentLabel
        caseId="case-03"
        index={6}
        documentId="comments"
        visual="news"
        cost={1}
        hideIcon
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('CASE 03');
  });

  it('想定外の事件 ID 形式でも落ちずに表示する', () => {
    expect(formatCaseId('case-7')).toBe('CASE 07');
    expect(formatCaseId('case-12')).toBe('CASE 12');
    expect(formatCaseId('special')).toBe('SPECIAL');
    expect(formatDocumentNumber(3)).toBe('03');
    expect(formatDocumentNumber(12)).toBe('12');
  });
});

describe('visual enum と props アイコンの対応表', () => {
  it('schema の visual enum を漏れなく網羅し、PROP_NAMES に実在する名前だけを使う', () => {
    const schema = JSON.parse(
      readFileSync(resolve(ROOT, 'data/schema/case.schema.json'), 'utf-8'),
    ) as { $defs: { visual: { enum: string[] } } };
    const enumValues = [...schema.$defs.visual.enum].sort();
    expect(Object.keys(VISUAL_PROP).sort()).toEqual(enumValues);
    expect(Object.keys(VISUAL_LABEL).sort()).toEqual(enumValues);
    expect([...DOCUMENT_VISUALS].sort()).toEqual(enumValues);
    for (const prop of Object.values(VISUAL_PROP)) {
      expect(PROP_NAMES).toContain(prop);
    }
  });

  it('対応表の SVG がすべて public/assets/props に存在する', () => {
    for (const prop of Object.values(VISUAL_PROP)) {
      expect(() =>
        readFileSync(resolve(ROOT, `public/assets/props/${prop}.svg`), 'utf-8'),
      ).not.toThrow();
    }
  });

  it('収録 5 事件の全資料がラベルを描画できる', () => {
    for (const c of CASES) {
      c.documents.forEach((d, i) => {
        const { container, unmount } = render(
          <DocumentLabel
            caseId={c.id}
            index={i + 1}
            documentId={d.id}
            visual={d.visual}
            cost={d.cost}
          />,
        );
        expect(container).toHaveTextContent(formatCaseId(c.id));
        expect(container).toHaveTextContent(VISUAL_LABEL[d.visual]);
        unmount();
      });
    }
  });
});
