import { render, screen } from '@testing-library/react';
import { FailureReasons } from './FailureReasons';

describe('FailureReasons', () => {
  it('理由が無ければ何も描画しない', () => {
    const { container } = render(<FailureReasons reasons={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('渡された不足種別だけを list で表示する', () => {
    render(
      <FailureReasons
        reasons={[
          { track: 'evidence', message: '必要な裏付け資料が 1 件足りません' },
          { track: 'article', message: '見出しの断片の選択か順序に誤りがあります' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: '差し戻しの理由' });
    const items = screen.getAllByRole('listitem');
    expect(list).toBeInTheDocument();
    expect(items.map((li) => li.textContent)).toEqual([
      '必要な裏付け資料が 1 件足りません',
      '見出しの断片の選択か順序に誤りがあります',
    ]);
    expect(screen.queryByText(/照合/)).not.toBeInTheDocument();
  });
});
