import { render, screen } from '@testing-library/react';
import { CaseNotebook } from './CaseNotebook';
import { CASES } from '../data/cases';
import { createProgress } from '../domain/game';
import { spentBudget } from '../domain/budget';

describe('CaseNotebook', () => {
  it('事件ごとの状態と使用予算（spentBudget）を出す', () => {
    const c2 = CASES[1]!;
    const opened = c2.documents.slice(0, 2).map((d) => d.id);
    const p2 = { ...createProgress(), opened };
    render(
      <CaseNotebook
        cases={CASES}
        progressByCase={{ 'case-02': p2 }}
        finished={{ 'case-01': true }}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(CASES.length);
    expect(screen.getByText('CASE 01')).toBeInTheDocument();
    expect(screen.getByText('解決')).toBeInTheDocument();
    expect(screen.getByText('調査中')).toBeInTheDocument();
    const spent = spentBudget(c2, p2);
    expect(screen.getByLabelText(`調査予算 ${spent} / ${c2.budget}`)).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(`調査予算 0 / ${CASES[0]!.budget}`).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText('少数の選択から心理特性を診断するものではありません。'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/あなたは|タイプ|性格/);
  });
});
