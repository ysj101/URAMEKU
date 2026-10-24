import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('事件を選ぶとプレイ画面になり予算が表示される', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /事件一覧/ }));
    await userEvent.click(screen.getByRole('button', { name: /CASE 02/ }));
    expect(window.location.hash).toBe('#/play/case-02');
    expect(screen.getByText(/調査予算：残り 4 \/ 4/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('半額セールの値札');
  });

  it('URL の事件 ID から直接開ける', () => {
    window.location.hash = '#/play/case-05';
    render(<App />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('急上昇するグラフ');
  });
});
