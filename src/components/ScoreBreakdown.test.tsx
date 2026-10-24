import { render, screen, within } from '@testing-library/react';
import { ScoreBreakdown } from './ScoreBreakdown';
import { evaluateCase } from '../domain/scoring';
import { clearedProgress, makeCase } from '../test/fixtures';

describe('ScoreBreakdown', () => {
  it('系統 / 得点 / 満点をテーブルで表示し、合計行を持つ', () => {
    const r = evaluateCase(makeCase(), clearedProgress());
    render(<ScoreBreakdown rows={r.breakdown} />);
    const table = screen.getByRole('table', { name: '配点の内訳' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['系統', '得点', '満点']);
    const evidence = within(table).getByRole('row', { name: /必要な裏付け資料/ });
    expect(evidence).toHaveTextContent('24');
    const total = within(table).getByRole('row', { name: /合計/ });
    expect(total).toHaveTextContent(`${r.points}`);
    expect(total).toHaveTextContent('100');
    expect(within(table).getAllByRole('row')).toHaveLength(1 + r.breakdown.length + 1);
  });
});
