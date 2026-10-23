import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { announcementFor, pickFocusTarget, useFocusOnRouteChange } from './useFocusOnRouteChange';

function Harness({ initial }: { initial: string }) {
  const [route, setRoute] = useState(initial);
  const announcement = useFocusOnRouteChange(route);
  return (
    <>
      <div aria-live="polite" data-testid="announcer">
        {announcement}
      </div>
      <main id="workbench" tabIndex={-1}>
        {route === 'home' && <h1>ウラメク</h1>}
        {route === 'play' && (
          <>
            <h2>半額セールの値札</h2>
            <span data-focus-target>STEP 01 / 資料を調べる</span>
          </>
        )}
        {route === 'plain' && <p>見出しなし</p>}
        <button type="button" onClick={() => setRoute('home')}>
          home
        </button>
        <button type="button" onClick={() => setRoute('play')}>
          play
        </button>
        <button type="button" onClick={() => setRoute('plain')}>
          plain
        </button>
      </main>
    </>
  );
}

describe('useFocusOnRouteChange', () => {
  it('初回マウントではフォーカスを動かさない', () => {
    render(<Harness initial="home" />);
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByTestId('announcer')).toHaveTextContent('');
  });

  it('遷移後は h1 に tabindex=-1 を付けてフォーカスし、画面名を告知する', () => {
    render(<Harness initial="plain" />);
    act(() => screen.getByRole('button', { name: 'home' }).click());
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(document.activeElement).toBe(h1);
    expect(h1).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('announcer')).toHaveTextContent('ウラメク');
  });

  it('data-focus-target があればそちらを優先し、h1 が無ければ main に落とす', () => {
    render(<Harness initial="home" />);
    act(() => screen.getByRole('button', { name: 'play' }).click());
    expect(document.activeElement).toHaveTextContent('STEP 01 / 資料を調べる');
    expect(screen.getByTestId('announcer')).toHaveTextContent('STEP 01 / 資料を調べる');

    act(() => screen.getByRole('button', { name: 'plain' }).click());
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('pickFocusTarget / announcementFor は h1 とフォーカス先を組み合わせる', () => {
    const main = document.createElement('main');
    main.innerHTML = '<h1>設定</h1><span data-focus-target>記録の管理</span>';
    const target = pickFocusTarget(main);
    expect(target).toHaveTextContent('記録の管理');
    expect(announcementFor(main, target)).toBe('設定、記録の管理');
    main.innerHTML = '<h1>ウラメク</h1>';
    expect(announcementFor(main, pickFocusTarget(main))).toBe('ウラメク');
  });
});
