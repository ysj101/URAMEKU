import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CASES, findCase } from '../data/cases';

const case01 = findCase('case-01')!;
const case02 = findCase('case-02')!;
import { validateCase } from '../data/validateCase';
import { VisualCaseGuide } from './VisualCaseGuide';

it('case-01 explains the same retained group with two denominators and evidence', () => {
  const current = case01;
  render(<VisualCaseGuide caseData={current} />);
  expect(screen.getByRole('img')).toHaveAttribute(
    'src',
    expect.stringContaining('/assets/cases/case-01/debrief/'),
  );
  expect(screen.getByText('45人 ÷ 50人')).toBeInTheDocument();
  expect(screen.getByText('45人 ÷ 100人')).toBeInTheDocument();
  expect(screen.getByText(current.debrief.visualGuide!.limit)).toBeInTheDocument();
});

it('rejects mismatched percentages and missing source documents', () => {
  const current = structuredClone(case01);
  current.debrief.visualGuide!.comparisons![0]!.percent = 45;
  current.debrief.visualGuide!.steps![0]!.evidence = ['missing'];
  const result = validateCase(current);
  expect(result.ok).toBe(false);
  expect(result.errors.join(' ')).toContain('人数と割合が一致しません');
  expect(result.errors.join(' ')).toContain('資料が存在しません');
});

it('leaves cases without visual guides unchanged', () => {
  const current = structuredClone(case02);
  delete current.debrief.visualGuide;
  const { container } = render(<VisualCaseGuide caseData={current} />);
  expect(container).toBeEmptyDOMElement();
});

for (const current of CASES.filter((c) => c.id !== 'case-01')) {
  it(`${current.id} explains its own mechanism and source facts without a people-only formula`, () => {
    render(<VisualCaseGuide caseData={current} />);
    const guide = current.debrief.visualGuide!;
    expect(screen.getByRole('img')).toHaveAttribute('alt', guide.imageAlt);
    expect(screen.getByRole('heading', { name: guide.title })).toBeInTheDocument();
    for (const panel of guide.panels!) expect(screen.getByText(panel.body)).toBeInTheDocument();
    expect(screen.getByText(guide.limit)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '資料で追う人数の変化' })).not.toBeInTheDocument();
  });
}

it('requires a readable explanation and valid sources for the panels', () => {
  const current = structuredClone(case02);
  current.debrief.visualGuide!.panels![0]!.evidence = ['missing'];
  expect(validateCase(current).ok).toBe(false);
  delete current.debrief.visualGuide!.panels;
  expect(validateCase(current).ok).toBe(false);
});
