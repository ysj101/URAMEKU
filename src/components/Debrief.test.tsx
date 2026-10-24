import { render, screen } from '@testing-library/react';
import { Debrief } from './Debrief';
import { UI } from '../data/ui';
import { makeCase } from '../test/fixtures';

describe('Debrief', () => {
  it('バイアス名を見出しにし、解説・持ち帰る視点・disclaimer・非診断注記を出す', () => {
    const caseData = makeCase({
      bias: '分母の省略',
      debrief: { explanation: '分母を省くと読み手の理解が変わる。', takeaway: '分母を確認する。' },
      disclaimer: '登場する企業・人物・統計はすべて架空です。',
    });
    render(<Debrief caseData={caseData} />);
    expect(screen.getByRole('region', { name: /分母の省略/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('編集後記分母の省略');
    expect(screen.getByText('分母を省くと読み手の理解が変わる。')).toBeInTheDocument();
    expect(screen.getByText(/分母を確認する。/)).toBeInTheDocument();
    expect(screen.getByTestId('case-disclaimer')).toHaveTextContent(
      '登場する企業・人物・統計はすべて架空です。',
    );
    expect(screen.getByText(new RegExp(UI.notices.notDiagnosis))).toBeInTheDocument();
  });

  it('実データの 5 事件すべてで disclaimer が空でなく表示される', async () => {
    const { CASES } = await import('../data/cases');
    for (const c of CASES) {
      const { unmount } = render(<Debrief caseData={c} />);
      expect(screen.getByTestId('case-disclaimer').textContent?.length).toBeGreaterThan(0);
      unmount();
    }
  });
});
