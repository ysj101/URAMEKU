import { fireEvent, render, screen, within } from '@testing-library/react';
import { DocumentGrid } from './DocumentGrid';
import { CASES } from '../data/cases';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase();

describe('DocumentGrid（調査デスク）', () => {
  it('全事件の 30 資料がタイルとして表示される', () => {
    let total = 0;
    for (const c of CASES) {
      const { container, unmount } = render(
        <DocumentGrid caseData={c} progress={makeProgress()} onOpen={vi.fn()} />,
      );
      const tiles = within(container).getAllByRole('button');
      expect(tiles).toHaveLength(c.documents.length);
      for (const d of c.documents) {
        expect(within(container).getByText(d.title)).toBeInTheDocument();
      }
      total += tiles.length;
      unmount();
    }
    expect(total).toBe(30);
  });

  it('タップで onOpen が呼ばれる', () => {
    const onOpen = vi.fn();
    render(<DocumentGrid caseData={caseData} progress={makeProgress()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /資料A/ }));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('状態はテキストとアイコンで示す（未調査 / 調査済み）', () => {
    render(
      <DocumentGrid
        caseData={caseData}
        progress={makeProgress({ opened: ['a', 'b'] })}
        onOpen={vi.fn()}
      />,
    );
    const a = screen.getByRole('button', { name: /資料A/ });
    const b = screen.getByRole('button', { name: /資料B/ });
    const c = screen.getByRole('button', { name: /資料C/ });
    expect(a).toHaveTextContent('調査済み');
    expect(a).toHaveTextContent('再読は無料');
    expect(b).toHaveTextContent('調査済み');
    expect(c).toHaveTextContent('未調査');
    expect(c).toHaveTextContent('調査コスト 1');
    expect(a.querySelector('.doc-tile__icon')).toHaveAttribute(
      'src',
      expect.stringMatching(/verified\.svg$/),
    );
    expect(b.querySelector('.doc-tile__icon')).toHaveAttribute(
      'src',
      expect.stringMatching(/verified\.svg$/),
    );
    expect(c.querySelector('.doc-tile__icon')).toHaveAttribute(
      'src',
      expect.stringMatching(/unseen\.svg$/),
    );
    expect(screen.getByRole('button', { name: /無料資料/ })).toHaveTextContent('無料で確認');
  });

  it('予算不足の資料は aria-disabled で理由を表示し、タップで status に理由を告げる', () => {
    const onOpen = vi.fn();
    // budget 3、d（コスト 2）を開くと残り 1 → d 自体は閲覧済み、未読の e（コスト 2）は開けない
    const data = makeCase({
      documents: [
        ...caseData.documents,
        { id: 'e', title: '資料E', content: 'x', cost: 2, visual: 'photo' },
      ],
    });
    render(
      <DocumentGrid caseData={data} progress={makeProgress({ opened: ['d'] })} onOpen={onOpen} />,
    );
    const e = screen.getByRole('button', { name: /資料E/ });
    expect(e).toHaveAttribute('aria-disabled', 'true');
    expect(e).not.toBeDisabled();
    expect(e).toHaveTextContent('予算不足');
    expect(e.querySelector('.doc-tile__icon')).toHaveAttribute(
      'src',
      expect.stringMatching(/locked\.svg$/),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(e);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '「資料E」は予算不足のため開けません（必要 2、残り 1）',
    );

    // 開ける資料をタップすると理由は消える
    fireEvent.click(screen.getByRole('button', { name: /資料A/ }));
    expect(onOpen).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
