import { fireEvent, render, screen, within } from '@testing-library/react';
import { DocumentGrid } from './DocumentGrid';
import { CASES } from '../data/cases';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase();

describe('DocumentGrid（調査デスク）', () => {
  it('全事件の全資料がタイルとして表示される', () => {
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
    expect(total).toBe(CASES.reduce((sum, c) => sum + c.documents.length, 0));
  });

  it('タップで onOpen が呼ばれる', () => {
    const onOpen = vi.fn();
    render(<DocumentGrid caseData={caseData} progress={makeProgress()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /資料A/ }));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('状態はテキストとアイコンで示す（未読 / 調査済み）', () => {
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
    // 読み上げは「題名、状態、コスト」の順（#173）
    expect(a).toHaveAccessibleName('資料A、調査済み、再読は無料');
    expect(c).toHaveAccessibleName('資料C、未読、調査コスト 1');
    // 見た目：既読はチェックと「読んだ」、未読は印なし。「未調査」「調査コスト」の文字は出さない
    expect(a).toHaveTextContent('読んだ');
    expect(b).toHaveTextContent('読んだ');
    expect(c).not.toHaveTextContent('読んだ');
    expect(c).not.toHaveTextContent('未調査');
    expect(c).not.toHaveTextContent('調査コスト');
    expect(a.querySelector('.doc-tile__icon')).toHaveAttribute(
      'src',
      expect.stringMatching(/verified\.svg$/),
    );
    expect(b.querySelector('.doc-tile__icon')).toHaveAttribute(
      'src',
      expect.stringMatching(/verified\.svg$/),
    );
    expect(c.querySelector('.doc-tile__icon')).toBeNull();
    // コストは予算と同じピップ 1 個。無料は「無料」の文字のみ
    expect(c.querySelector('.doc-tile__cost .v2-meter__pip')).not.toBeNull();
    const free = screen.getByRole('button', { name: /無料資料/ });
    expect(free).toHaveAccessibleName(/無料資料、未読、無料で確認/);
    expect(free.querySelector('.doc-tile__cost')).toHaveTextContent('無料');
    expect(free.querySelector('.doc-tile__cost .v2-meter__pip')).toBeNull();
    // 内部 ID と事件 ID はカードの見た目に出さず、data 属性に残す
    expect(c).not.toHaveTextContent('（c）');
    expect(c).not.toHaveTextContent('CASE');
    expect(c.querySelector('[data-document="c"]')).not.toBeNull();
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
