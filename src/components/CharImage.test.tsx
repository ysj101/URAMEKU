import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharImage } from './CharImage';
import { characterAlt } from './characterLabels';
import { CHARACTER_IDS, CHARACTER_POSES, REACTIONS } from '../data/assets';
import { isKnownAsset } from '../data/assetManifest';
import { CHARACTER_POSE_SIZES, CHARACTER_REACTION_SIZE } from '../data/characterSizes';
import { UI } from '../data/ui';

describe('CharImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('全キャラ×収録ポーズの画像がマニフェストに実在し、alt はキャラ名＋状態の日本語', () => {
    for (const id of CHARACTER_IDS) {
      for (const pose of CHARACTER_POSES[id]) {
        const { unmount } = render(<CharImage character={id} pose={pose} />);
        const img = screen.getByRole('img');
        expect(isKnownAsset(img.getAttribute('src')!), `${id}/${pose}`).toBe(true);
        expect(img.getAttribute('src')).toBe(`/assets/characters/${id}/poses/${pose}.png`);
        expect(img).toHaveAttribute(
          'alt',
          `${UI.characters.names[id]}（${UI.characters.poses[pose]}）`,
        );
        expect(img).toHaveAttribute('width', String(CHARACTER_POSE_SIZES[id][0]));
        expect(img).toHaveAttribute('height', String(CHARACTER_POSE_SIZES[id][1]));
        expect(img).toHaveAttribute('loading', 'lazy');
        expect(img).toHaveAttribute('decoding', 'async');
        unmount();
      }
    }
  });

  it('全キャラ×リアクション（記号を重ねた補助状態）の画像がマニフェストに実在する', () => {
    for (const id of CHARACTER_IDS) {
      for (const reaction of REACTIONS) {
        const { unmount } = render(<CharImage character={id} reaction={reaction} />);
        const img = screen.getByRole('img');
        expect(isKnownAsset(img.getAttribute('src')!), `${id}/${reaction}`).toBe(true);
        expect(img).toHaveAttribute('alt', characterAlt(id, { reaction }));
        expect(img).toHaveAttribute('width', String(CHARACTER_REACTION_SIZE[0]));
        expect(img).toHaveAttribute('height', String(CHARACTER_REACTION_SIZE[1]));
        expect(img).toHaveAttribute('data-state', reaction);
        unmount();
      }
    }
  });

  it('省略時は idle ポーズ', () => {
    render(<CharImage character="harada" />);
    const img = screen.getByRole('img', { name: 'ハラダ部長（待機）' });
    expect(img).toHaveAttribute('src', '/assets/characters/harada/poses/idle.png');
  });

  it('size・className・alt の上書き・loading が反映される', () => {
    render(
      <CharImage character="shinobu" pose="point" size="md" className="x" alt="" loading="eager" />,
    );
    const img = screen.getByAltText('');
    expect(img).toHaveClass('char-image', 'char-image--md', 'x');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('alt', '');
  });

  it('収録されていない組み合わせは型エラー（実行時も例外）', () => {
    // React が例外を console.error に流すので、このテストの間だけ黙らせる
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // @ts-expect-error メガに point ポーズは無い
    expect(() => render(<CharImage character="mega" pose="point" />)).toThrow(/Pose unavailable/);
    // @ts-expect-error クロに inspect ポーズは無い
    expect(() => render(<CharImage character="kuro" pose="inspect" />)).toThrow(/Pose unavailable/);
    // @ts-expect-error pose と reaction は同時に指定できない
    const both = <CharImage character="shinobu" pose="idle" reaction="happy" />;
    expect(both).toBeTruthy();
  });

  it('characterAlt は ja.json の名前と状態名を結合する', () => {
    expect(characterAlt('mega', { pose: 'idle' })).toBe('メガ（待機）');
    expect(characterAlt('kuro', { reaction: 'thinking' })).toBe('クロ（考え中）');
  });
});
