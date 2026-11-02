import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveTutorialState } from '../state/tutorialState';
import { App } from './App';

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
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('練習が未完了なら「調査をはじめる」でCASE00を開く', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '調査をはじめる' }));
    expect(window.location.hash).toBe('#/tutorial');
    expect(screen.getByRole('heading', { name: '消えたMサイズ' })).toBeInTheDocument();
  });

  it('練習が完了していれば、通常事件の記録がなくてもCASE01を開く', async () => {
    saveTutorialState({ completed: true, hintsEnabled: true });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: '調査をはじめる' }));
    expect(window.location.hash).toBe('#/play/case-01');
    expect(screen.getByText('STEP 01 / 資料を調べる')).toBeInTheDocument();
  });

  it('事件を選ぶとプレイ画面になり予算が表示される', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /事件一覧/ }));
    await userEvent.click(screen.getByRole('button', { name: /CASE 02/ }));
    expect(window.location.hash).toBe('#/play/case-02');
    expect(screen.getByText(/調査予算：残り 4 \/ 4/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('半額セールの値札');
  });

  it('URL の事件 ID から直接開ける', () => {
    window.location.hash = '#/play/case-05';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('急上昇するグラフ');
  });
});
