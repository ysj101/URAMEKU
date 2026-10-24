// jsdom には AnimationEvent が無く、React DOM は読み込み時に存在を見て
// 購読するイベント名を決めるため、import より前に定義しておく。
vi.hoisted(() => {
  if (!('AnimationEvent' in window)) {
    (window as unknown as { AnimationEvent: typeof Event }).AnimationEvent = class extends Event {};
  }
});

import { fireEvent, render, screen } from '@testing-library/react';
import { Stamp } from './Stamp';
import { STAMP_LABEL, stampAssetPath, type StampKind } from './stampAssets';
import { MOTION_ATTRIBUTE } from '../app/motionSettings';

const KINDS: StampKind[] = ['accepted', 'rejected', 'draft', 'perfect', 'verified', 'confidential'];

describe('Stamp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute(MOTION_ATTRIBUTE);
  });

  it('実在するスタンプ画像を参照し、印字文言を alt にする', () => {
    for (const kind of KINDS) {
      const { unmount } = render(<Stamp kind={kind} />);
      const img = screen.getByRole('img', { name: STAMP_LABEL[kind] });
      expect(img).toHaveAttribute('src', `/assets/${stampAssetPath(kind)}`);
      expect(img).toHaveAttribute('data-stamp', kind);
      unmount();
    }
  });

  it('通常時は押下演出クラスが付き、animationend で onSettled が呼ばれる', () => {
    const onSettled = vi.fn();
    render(<Stamp kind="accepted" onSettled={onSettled} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('data-animated', 'true');
    expect(img).toHaveClass('motion-stamp-press', 'is-animating');
    expect(onSettled).not.toHaveBeenCalled();

    fireEvent.animationEnd(img);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(img).not.toHaveClass('is-animating');
    expect(img).toHaveClass('motion-stamp-press'); // fill-mode で最終状態を保持
  });

  it('reduced（アプリ設定）時は演出なしで即時に最終状態になる', () => {
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, 'reduced');
    const onSettled = vi.fn();
    render(<Stamp kind="rejected" onSettled={onSettled} />);
    const img = screen.getByRole('img', { name: '要再調査' });
    expect(img).toHaveAttribute('data-animated', 'false');
    expect(img).not.toHaveClass('motion-stamp-press');
    expect(img).not.toHaveClass('is-animating');
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('reduced（OS 設定）時も同様', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    render(<Stamp kind="perfect" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-animated', 'false');
  });

  it('animate=false なら演出なし', () => {
    const onSettled = vi.fn();
    render(<Stamp kind="draft" animate={false} onSettled={onSettled} />);
    expect(screen.getByRole('img')).toHaveAttribute('data-animated', 'false');
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
