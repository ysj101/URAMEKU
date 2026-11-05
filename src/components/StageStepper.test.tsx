import { render, screen } from '@testing-library/react';
import { StageStepper } from './StageStepper';

describe('StageStepper', () => {
  it('3 段階を並べ、現在の段階に aria-current="step" を付ける', () => {
    render(<StageStepper current="report" />);
    const list = screen.getByRole('list', { name: '調査の段階' });
    const items = screen.getAllByRole('listitem');
    expect(list).toBeInTheDocument();
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('3 段階中 1 番目、資料を調べる（済み）');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).toHaveTextContent('3 段階中 2 番目、報告をまとめる');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[2]).not.toHaveAttribute('aria-current');
    expect(items[2]).toHaveTextContent('3 段階中 3 番目、結果');
  });

  it('済んだ段階だけにチェックの図を出し、図は読み上げから外す', () => {
    render(<StageStepper current="report" />);
    const [done, current, next] = screen.getAllByRole('listitem');
    expect(done?.querySelector('img')).not.toBeNull();
    expect(current?.querySelector('img')).toBeNull();
    expect(next?.querySelector('img')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('focusTarget を付けると現在の段階が画面遷移時のフォーカス先になる', () => {
    render(<StageStepper current="investigate" focusTarget />);
    const current = screen.getByRole('listitem', { current: 'step' });
    expect(current).toHaveAttribute('data-focus-target');
    expect(current).toHaveAttribute('tabindex', '-1');
    expect(document.querySelectorAll('[data-focus-target]')).toHaveLength(1);
  });
});
