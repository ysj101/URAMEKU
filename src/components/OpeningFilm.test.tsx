import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { OpeningFilm } from './OpeningFilm';

it('演出設定、初回のスキップ、再訪時の省略を扱う', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const proto = HTMLDialogElement.prototype;
  Object.defineProperties(proto, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  try {
    document.documentElement.dataset.motion = 'reduced';
    const first = render(<OpeningFilm />);
    expect(screen.queryByRole('dialog')).toBeNull();
    first.unmount();
    delete document.documentElement.dataset.motion;
    const second = render(<OpeningFilm />);
    fireEvent.click(screen.getByRole('button', { name: '動画をスキップ' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    second.unmount();
    render(<OpeningFilm />);
    expect(screen.queryByRole('dialog')).toBeNull();
  } finally {
    delete document.documentElement.dataset.motion;
    localStorage.clear();
    Reflect.deleteProperty(proto, 'showModal');
    Reflect.deleteProperty(proto, 'close');
    vi.restoreAllMocks();
  }
});
