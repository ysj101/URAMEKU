import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  beforeEach(() => localStorage.clear());
  it('タイトルと事件一覧を表示する', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ウラメク');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText(/調査予算：残り 4 \/ 4/)).toBeInTheDocument();
  });
});
