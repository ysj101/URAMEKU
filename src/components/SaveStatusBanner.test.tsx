import { fireEvent, render, screen } from '@testing-library/react';
import { SaveStatusBanner } from './SaveStatusBanner';
import { UI } from '../data/ui';

describe('SaveStatusBanner', () => {
  it('saved / 未指定 では何も出さない', () => {
    const { container, rerender } = render(<SaveStatusBanner status="saved" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SaveStatusBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('failed は容量不足の可能性と設定からの削除を案内する', () => {
    render(<SaveStatusBanner status="failed" />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(UI.status.saveFailed.title);
    expect(banner).toHaveTextContent('容量不足の可能性');
    expect(banner).toHaveTextContent('設定から記録を削除');
    expect(screen.getByRole('link', { name: UI.status.saveFailed.settings })).toHaveAttribute(
      'href',
      '#/settings',
    );
  });

  it('failed で onOpenSettings があればボタンで呼ぶ', () => {
    const open = vi.fn();
    render(<SaveStatusBanner status="failed" onOpenSettings={open} />);
    fireEvent.click(screen.getByRole('button', { name: UI.status.saveFailed.settings }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('unavailable は保存が無効なことと、閉じると進行が消えることを伝える', () => {
    render(<SaveStatusBanner status="unavailable" />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(UI.status.saveUnavailable.title);
    expect(banner).toHaveTextContent('閉じると進行が消えます');
    expect(screen.queryByRole('link')).toBeNull();
  });
});
