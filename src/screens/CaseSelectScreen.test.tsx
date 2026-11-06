import { render, screen } from '@testing-library/react';
import { CaseSelectScreen } from './CaseSelectScreen';
import { CASES } from '../data/cases';
import { createProgress } from '../domain/game';
import type { GameApi } from '../state/useGame';
import type { Navigation } from '../app/navigation';

function api(overrides: Partial<GameApi> = {}): GameApi {
  return {
    cases: CASES,
    current: CASES[0]!,
    progress: createProgress(),
    stage: 'investigate',
    finished: {},
    progressByCase: {},
    dispatch: vi.fn(),
    selectCase: vi.fn(),
    setStage: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
    ...overrides,
  };
}

const nav: Navigation = { route: { screen: 'cases' }, navigate: vi.fn(), back: vi.fn() };

describe('CaseSelectScreen', () => {
  it('全件を難易度と状態つきで、標準を先頭にして表示する', () => {
    const [first, second, third] = CASES;
    render(
      <CaseSelectScreen
        game={api({
          finished: { [first!.id]: true },
          progressByCase: {
            [second!.id]: { ...createProgress(), opened: [second!.documents[1]!.id] },
          },
        })}
        nav={nav}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(CASES.length);
    expect(first!.difficulty).toBe('NORMAL');
    expect(screen.getByRole('button', { name: /CASE 01.*難易度 標準.*解決/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CASE 02.*調査中/ })).toBeInTheDocument();
    expect(third!.difficulty).toBe('HARD');
    expect(
      screen.getByRole('button', { name: /CASE 03.*難易度 難関.*未着手/ }),
    ).toBeInTheDocument();
  });
});
