import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CASES } from '../data/cases';
import { validateCase } from '../data/validateCase';
import { VisualCaseGuide } from './VisualCaseGuide';

it('case-01 explains the same retained group with two denominators and evidence', () => {
  const current = CASES[0]!;
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
  const current = structuredClone(CASES[0]!);
  current.debrief.visualGuide!.comparisons![0]!.percent = 45;
  current.debrief.visualGuide!.steps![0]!.evidence = ['missing'];
  const result = validateCase(current);
  expect(result.ok).toBe(false);
  expect(result.errors.join(' ')).toContain('人数と割合が一致しません');
  expect(result.errors.join(' ')).toContain('資料が存在しません');
});

it('leaves cases without visual guides unchanged', () => {
  const current = structuredClone(CASES[1]!);
  delete current.debrief.visualGuide;
  const { container } = render(<VisualCaseGuide caseData={current} />);
  expect(container).toBeEmptyDOMElement();
});

for (const current of CASES.slice(1)) {
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
  const current = structuredClone(CASES[1]!);
  current.debrief.visualGuide!.panels![0]!.evidence = ['missing'];
  expect(validateCase(current).ok).toBe(false);
  delete current.debrief.visualGuide!.panels;
  expect(validateCase(current).ok).toBe(false);
});
