// jsdom には AnimationEvent が無く、React DOM は読み込み時に存在を見て
// 購読するイベント名を決めるため、import より前に定義しておく。
vi.hoisted(() => {
  if (!('AnimationEvent' in window)) {
    (window as unknown as { AnimationEvent: typeof Event }).AnimationEvent = class extends Event {};
  }
});

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterReaction } from './CharacterReaction';
import { effectLabel } from './characterLabels';
import { CHARACTER_IDS, EFFECT_REACTION_NAMES } from '../data/assets';
import { isKnownAsset } from '../data/assetManifest';
import { MOTION_ATTRIBUTE } from '../app/motionSettings';
import { UI } from '../data/ui';

describe('CharacterReaction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.removeAttribute(MOTION_ATTRIBUTE);
  });

  it('全キャラ×全記号で、原画（idle）と記号の両方がマニフェストに実在する', () => {
    for (const id of CHARACTER_IDS) {
      for (const effect of EFFECT_REACTION_NAMES) {
        const { container, unmount } = render(<CharacterReaction character={id} effect={effect} />);
        const base = container.querySelector<HTMLImageElement>('.char-image')!;
        const overlay = container.querySelector<HTMLImageElement>('.char-reaction__effect')!;
        expect(base.getAttribute('src')).toBe(`/assets/characters/${id}/poses/idle.png`);
        expect(isKnownAsset(base.getAttribute('src')!)).toBe(true);
        expect(overlay.getAttribute('src')).toBe(`/assets/effects/reactions/${effect}.svg`);
        expect(isKnownAsset(overlay.getAttribute('src')!)).toBe(true);
        // 読み上げは枠 1 つ分だけ。内側の img は装飾扱い
        expect(base).toHaveAttribute('alt', '');
        expect(overlay).toHaveAttribute('alt', '');
        expect(
          screen.getByRole('img', {
            name: `${UI.characters.names[id]}（${UI.characters.effects[effect]}）`,
          }),
        ).toHaveAttribute('data-effect', effect);
        unmount();
      }
    }
  });

  it('原画はポーズまたはリアクション補助状態を選べる（顔は差し替えない）', () => {
    const { container, rerender } = render(
      <CharacterReaction character="shinobu" pose="inspect" effect="focus" />,
    );
    expect(container.querySelector('.char-image')).toHaveAttribute(
      'src',
      '/assets/characters/shinobu/poses/inspect.png',
    );
    rerender(<CharacterReaction character="shinobu" reaction="worried" effect="conflict" />);
    expect(container.querySelector('.char-image')).toHaveAttribute(
      'src',
      '/assets/characters/shinobu/reactions/worried.png',
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      // @ts-expect-error ハラダに explain ポーズは無い
      render(<CharacterReaction character="harada" pose="explain" effect="idea" />),
    ).toThrow(/Pose unavailable/);
  });

  it('通常時は記号に出現演出クラスが付き、animationend で is-animating が外れる', () => {
    const { container } = render(<CharacterReaction character="kuro" effect="idea" />);
    const wrapper = screen.getByRole('img');
    const overlay = container.querySelector('.char-reaction__effect')!;
    expect(wrapper).toHaveAttribute('data-animated', 'true');
    expect(wrapper).toHaveClass('char-reaction--top-right');
    expect(overlay).toHaveClass('motion-effect-pop', 'is-animating');
    fireEvent.animationEnd(overlay);
    expect(overlay).not.toHaveClass('is-animating');
    expect(overlay).toHaveClass('motion-effect-pop');
  });

  it('reduced（アプリ設定）時は演出クラスを付けず最終状態を即時表示する', () => {
    document.documentElement.setAttribute(MOTION_ATTRIBUTE, 'reduced');
    const { container } = render(<CharacterReaction character="mega" effect="question" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-animated', 'false');
    expect(container.querySelector('.char-reaction__effect')).not.toHaveClass('motion-effect-pop');
  });

  it('reduced（OS 設定）時も同様', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<CharacterReaction character="mega" effect="surprise" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-animated', 'false');
  });

  it('animate=false・placement・label の上書き', () => {
    render(
      <CharacterReaction
        character="harada"
        effect="discovery"
        animate={false}
        placement="top-left"
        label="部長が気づいた"
      />,
    );
    const wrapper = screen.getByRole('img', { name: '部長が気づいた' });
    expect(wrapper).toHaveAttribute('data-animated', 'false');
    expect(wrapper).toHaveClass('char-reaction--top-left');
    expect(effectLabel('harada', 'discovery')).toBe('ハラダ部長（発見）');
  });
});
