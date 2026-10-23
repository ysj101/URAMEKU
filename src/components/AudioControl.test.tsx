import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioControl } from './AudioControl';
import { SoundManager } from '../audio/soundManager';
import { AUDIO_SETTINGS_KEY, loadAudioSettings } from '../audio/audioSettings';
import type { StorageLike } from '../state/persistence';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function setup(initial?: { muted: boolean; volume: number }) {
  const storage = memoryStorage();
  if (initial) storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(initial));
  const manager = new SoundManager({
    createContext: () => null,
    settings: initial ?? { muted: false, volume: 0.6 },
  });
  const applySpy = vi.spyOn(manager, 'applySettings');
  render(<AudioControl manager={manager} storage={storage} />);
  return { storage, manager, applySpy };
}

describe('AudioControl', () => {
  it('既定状態: ミュート OFF（aria-pressed=false）、音量 60', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'ミュート' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const slider = screen.getByRole('slider', { name: '音量' });
    expect(slider).toHaveValue('60');
    expect(slider).not.toBeDisabled();
  });

  it('ミュートトグルで aria-pressed が切り替わり保存される', async () => {
    const user = userEvent.setup();
    const { storage, applySpy } = setup();
    const toggle = screen.getByRole('button', { name: 'ミュート' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAccessibleName('ミュート解除');
    expect(loadAudioSettings(storage)).toEqual({ muted: true, volume: 0.6 });
    expect(applySpy).toHaveBeenLastCalledWith({ muted: true, volume: 0.6 });
    expect(screen.getByRole('slider', { name: '音量' })).toBeDisabled();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(loadAudioSettings(storage).muted).toBe(false);
  });

  it('音量スライダーの変更がマネージャと storage に反映される', () => {
    const { storage, applySpy } = setup();
    const slider = screen.getByRole('slider', { name: '音量' });
    fireEvent.change(slider, { target: { value: '25' } });
    expect(slider).toHaveValue('25');
    expect(loadAudioSettings(storage)).toEqual({ muted: false, volume: 0.25 });
    expect(applySpy).toHaveBeenLastCalledWith({ muted: false, volume: 0.25 });
    expect(slider).toHaveAttribute('aria-valuetext', '25%');
  });

  it('保存済み設定を初期値として読む', () => {
    setup({ muted: true, volume: 0.4 });
    expect(screen.getByRole('button', { name: 'ミュート解除' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('slider', { name: '音量' })).toHaveValue('40');
  });
});
