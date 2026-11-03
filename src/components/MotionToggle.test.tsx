import { fireEvent, render, screen } from '@testing-library/react';
import { MotionToggle } from './MotionToggle';
import { initMotionPreference } from '../app/motionSettings';

describe('MotionToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('「演出を見せる」スイッチで、オフにすると演出を減らす設定になる', () => {
    render(<MotionToggle />);
    const toggle = screen.getByRole('switch', { name: '演出を見せる' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(initMotionPreference()).toBe('reduced');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(initMotionPreference()).toBe('system');
  });
});
