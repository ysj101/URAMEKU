import { fireEvent, render, screen } from '@testing-library/react';
import { LazyImage } from './LazyImage';

describe('LazyImage', () => {
  it('既定で loading="lazy" decoding="async" と width/height を付ける', () => {
    render(<LazyImage src="/assets/x.png" alt="資料" width={440} height={580} />);
    const img = screen.getByRole('img', { name: '資料' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('width', '440');
    expect(img).toHaveAttribute('height', '580');
    expect(img).not.toHaveAttribute('fetchpriority');
  });

  it('priority で eager + fetchpriority="high" に切り替わる', () => {
    render(<LazyImage src="/assets/hero.png" alt="ヒーロー" width={300} height={400} priority />);
    const img = screen.getByRole('img', { name: 'ヒーロー' });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('className / style / その他の img 属性をそのまま渡す', () => {
    render(
      <LazyImage
        src="/assets/x.png"
        alt=""
        width={10}
        height={20}
        className="thumb"
        style={{ objectFit: 'contain' }}
        data-testid="thumb"
      />,
    );
    const img = screen.getByTestId('thumb');
    expect(img).toHaveClass('thumb');
    expect(img).toHaveStyle({ objectFit: 'contain' });
  });

  it('読み込み失敗時は同じ大きさの背景色プレースホルダーに置き換え、onError も呼ぶ', () => {
    const onError = vi.fn();
    render(
      <LazyImage
        src="/assets/missing.png"
        alt="資料"
        width={120}
        height={160}
        className="thumb"
        onError={onError}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: '資料' }));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('img', { name: '資料' })).not.toBeNull();
    const fallback = screen.getByTestId('lazy-image-fallback');
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback).toHaveClass('thumb', 'lazy-image-fallback');
    expect(fallback).toHaveAttribute('role', 'img');
    expect(fallback).toHaveAttribute('aria-label', '資料');
    expect(fallback).toHaveStyle({ width: '120px', height: '160px' });
    expect(fallback.style.background).toContain('var(--color-surface-aged)');
    // 失敗後に別の画像を要求しない
    expect(document.querySelector('img')).toBeNull();
  });

  it('装飾画像（alt=""）の失敗時は aria-hidden のプレースホルダーになる', () => {
    render(<LazyImage src="/assets/missing.png" alt="" width={10} height={10} data-testid="d" />);
    fireEvent.error(screen.getByTestId('d'));
    const fallback = screen.getByTestId('lazy-image-fallback');
    expect(fallback).toHaveAttribute('aria-hidden', 'true');
    expect(fallback).not.toHaveAttribute('role');
  });

  it('src が変わると失敗状態をリセットして再び img を描画する', () => {
    const { rerender } = render(<LazyImage src="/assets/a.png" alt="a" width={10} height={10} />);
    fireEvent.error(screen.getByRole('img', { name: 'a' }));
    expect(document.querySelector('img')).toBeNull();
    rerender(<LazyImage src="/assets/b.png" alt="b" width={10} height={10} />);
    expect(screen.getByRole('img', { name: 'b' })).toHaveAttribute('src', '/assets/b.png');
  });
});
