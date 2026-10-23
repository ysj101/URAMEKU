// jsdom には AnimationEvent が無く、React DOM は読み込み時に存在を見て
// 購読するイベント名を決めるため、import より前に定義しておく。
vi.hoisted(() => {
  if (!('AnimationEvent' in window)) {
    (window as unknown as { AnimationEvent: typeof Event }).AnimationEvent = class extends Event {};
  }
});

import { fireEvent, render, screen } from '@testing-library/react';
import { PaperCard } from './PaperCard';
import { MOTION_ATTRIBUTE } from '../app/motionSettings';

describe('PaperCard', () => {
  afterEach(() => document.documentElement.removeAttribute(MOTION_ATTRIBUTE));

  it('既定で置かれる演出クラスが付き、終了後に is-animating が外れる', () => {
    render(<PaperCard data-testid="card">本文</PaperCard>);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('paper-card', 'motion-card-place', 'is-animating');
    expect(card).toHaveAttribute('data-animated', 'true');
    fireEvent.animationEnd(card);
    expect(card).not.toHaveClass('is-animating');
  });

  it('enter="page" と tone を切り替えられる', () => {
    render(
      <PaperCard data-testid="card" enter="page" tone="note" className="extra">
        本文
      </PaperCard>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('paper-card', 'paper-card--note', 'motion-page-turn', 'extra');
  });

  it('reduced 時と enter="none" では演出クラスを付けない', () => {
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, 'reduced');
    render(<PaperCard data-testid="a">a</PaperCard>);
    expect(screen.getByTestId('a')).not.toHaveClass('motion-card-place');
    expect(screen.getByTestId('a')).toHaveAttribute('data-animated', 'false');
    document.documentElement.removeAttribute(MOTION_ATTRIBUTE);

    render(
      <PaperCard data-testid="b" enter="none">
        b
      </PaperCard>,
    );
    expect(screen.getByTestId('b')).not.toHaveClass('motion-card-place');
  });
});
