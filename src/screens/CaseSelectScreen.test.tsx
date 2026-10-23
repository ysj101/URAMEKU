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
  it('5 件を難易度と状態つきで表示する', () => {
    render(
      <CaseSelectScreen
        game={api({
          finished: { 'case-01': true },
          progressByCase: { 'case-02': { ...createProgress(), opened: ['poster'] } },
        })}
        nav={nav}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(screen.getByRole('button', { name: /CASE 01.*解決/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CASE 02.*調査中/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /CASE 03.*難易度 難関.*未着手/ }),
    ).toBeInTheDocument();
  });
});
