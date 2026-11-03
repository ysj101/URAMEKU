import { fireEvent, render, screen } from '@testing-library/react';
import { HintToggle } from './HintToggle';
import { TUTORIAL_STORAGE_KEY, loadTutorialState } from '../state/tutorialState';
import type { StorageLike } from '../state/persistence';

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('HintToggle', () => {
  it('「ヒントを閉じる」で消したヒントを、設定のスイッチで戻せる', () => {
    const storage = memoryStorage();
    storage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify({ completed: false, hintsEnabled: false }),
    );
    render(<HintToggle storage={storage} />);
    const toggle = screen.getByRole('switch', { name: 'はじめてのヒントを表示する' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(loadTutorialState(storage).hintsEnabled).toBe(true);
  });
});
