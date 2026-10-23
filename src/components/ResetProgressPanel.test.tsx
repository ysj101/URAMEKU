import { fireEvent, render, screen } from '@testing-library/react';
import { ResetProgressPanel } from './ResetProgressPanel';

describe('ResetProgressPanel の 2 段階確認', () => {
  it('初期状態では 2 つの操作ボタンだけを出し、確認文と完了表示は出さない', () => {
    render(<ResetProgressPanel onResetAll={vi.fn()} onResetCase={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'この事件をやり直す' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'この端末の記録をすべて削除' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('onResetCase が無ければ事件のやり直しボタンを出さない', () => {
    render(<ResetProgressPanel onResetAll={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'この事件をやり直す' })).not.toBeInTheDocument();
  });

  it('全件削除: ボタン → 確認 → 「やめる」で何も削除しない', () => {
    const onResetAll = vi.fn();
    render(<ResetProgressPanel onResetAll={onResetAll} />);
    fireEvent.click(screen.getByRole('button', { name: 'この端末の記録をすべて削除' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'すべての事件の進行とクリア記録を削除します',
    );
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }));
    expect(onResetAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'この端末の記録をすべて削除' })).toBeInTheDocument();
  });

  it('全件削除: ボタン → 確認 → 「削除する」で 1 回だけ実行し、完了を status で表示する', () => {
    const onResetAll = vi.fn();
    render(<ResetProgressPanel onResetAll={onResetAll} />);
    fireEvent.click(screen.getByRole('button', { name: 'この端末の記録をすべて削除' }));
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));
    expect(onResetAll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('この端末の記録をすべて削除しました');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('事件のやり直し: 事件名入りの確認文を出し、実行後は onResetAll を呼ばない', () => {
    const onResetAll = vi.fn();
    const onResetCase = vi.fn();
    render(
      <ResetProgressPanel
        onResetAll={onResetAll}
        onResetCase={onResetCase}
        caseTitle="テスト事件"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'この事件をやり直す' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      '「テスト事件」の調査途中の記録を消して',
    );
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));
    expect(onResetCase).toHaveBeenCalledTimes(1);
    expect(onResetAll).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('「テスト事件」の記録を消しました');
  });

  it('完了表示は次の操作を始めると消える', () => {
    render(<ResetProgressPanel onResetAll={vi.fn()} onResetCase={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'この事件をやり直す' }));
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'この端末の記録をすべて削除' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
