import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveTutorialState } from '../state/tutorialState';
import { App } from './App';
import { CASES } from '../data/cases';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('ホームを表示し、事件一覧へ遷移できる', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ウラメク');
    await userEvent.click(screen.getByRole('button', { name: /事件一覧/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('事件一覧');
    expect(screen.getAllByRole('listitem')).toHaveLength(CASES.length);
  });

  it('練習が未完了なら「調査をはじめる」でCASE00を開く', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '調査をはじめる' }));
    expect(window.location.hash).toBe('#/tutorial');
    expect(screen.getByRole('heading', { name: '映画の前に、ひと休み' })).toBeInTheDocument();
  });

  it('練習が完了していれば、通常事件の記録がなくても一覧の先頭（CASE 01）を開く', async () => {
    saveTutorialState({ completed: true, hintsEnabled: true });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '調査をはじめる' }));
    expect(window.location.hash).toBe(`#/play/${CASES[0]!.id}`);
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('資料を調べる');
  });

  it('事件を選ぶとプレイ画面になり予算が表示される', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /事件一覧/ }));
    const second = CASES[1]!;
    await userEvent.click(screen.getByRole('button', { name: /CASE 02/ }));
    expect(window.location.hash).toBe(`#/play/${second.id}`);
    expect(
      screen.getByRole('meter', { name: `調査予算：残り ${second.budget} / ${second.budget}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(second.title);
  });

  it('URL の事件 ID から直接開ける', () => {
    window.location.hash = '#/play/case-05';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('急上昇するグラフ');
  });
});
