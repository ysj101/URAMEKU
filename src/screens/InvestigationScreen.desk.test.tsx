import { fireEvent, render, screen } from '@testing-library/react';
import { InvestigationScreen } from './InvestigationScreen';
import type { GameApi } from '../state/useGame';
import { makeCase, makeProgress } from '../test/fixtures';

const caseData = makeCase();

function makeGame(): GameApi {
  return {
    cases: [caseData],
    current: caseData,
    progress: makeProgress({ opened: ['a'] }),
    stage: 'investigate',
    finished: {},
    dispatch: vi.fn(),
    selectCase: vi.fn(),
    setStage: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
    lastDocumentId: null,
    setLastDocument: vi.fn(),
  };
}

beforeEach(() => {
  vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
  vi.spyOn(window.history, 'back').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('InvestigationScreen の資料部分（MVP-022）', () => {
  it('タイルをタップすると open-document を dispatch し、最後に開いた資料を記録して開く', () => {
    const game = makeGame();
    render(<InvestigationScreen game={game} />);
    fireEvent.click(screen.getByRole('button', { name: /資料B/ }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'open-document', documentId: 'b' });
    expect(game.setLastDocument).toHaveBeenCalledWith('b');
    expect(screen.getByRole('heading', { name: '資料B' })).toBeInTheDocument();
    expect((document.querySelector('dialog') as HTMLDialogElement).open).toBe(true);
  });

  it('ダイアログのピン操作で toggle-pin を dispatch する', () => {
    const game = makeGame();
    render(<InvestigationScreen game={game} />);
    fireEvent.click(screen.getByRole('button', { name: /資料A/ }));
    fireEvent.click(screen.getByRole('button', { name: '証拠ボードに貼る' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'toggle-pin', documentId: 'a' });
    expect((document.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });
});
