import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { NumericField } from './NumericField';

const task = { unit: '円' };

/** 親が生の入力を保持する実運用に近い形で描画する */
function Harness({ initial = '', readOnly = false }: { initial?: string; readOnly?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <NumericField label="問1" task={task} value={value} onChange={setValue} readOnly={readOnly} />
  );
}

describe('NumericField の入力属性', () => {
  it('スマホで小数点キーボードが出る属性を持ち、type=number ではない', () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: '問1' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
  });

  it('onChange は正規化せず生の入力を渡す', () => {
    const onChange = vi.fn();
    render(<NumericField label="問1" task={task} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: '問1' }), {
      target: { value: '１，２００円' },
    });
    expect(onChange).toHaveBeenCalledWith('１，２００円');
  });
});

describe('NumericField の正規化表示', () => {
  it.each([
    ['全角', '１２００', '1200'],
    ['カンマ区切り', '1,200', '1200'],
    ['単位付き', '1200円', '1200'],
    ['全角・カンマ・単位の混在', '１，２００円', '1200'],
  ])('%s の入力は blur 後に正規化値を表示する', (_label, raw, normalized) => {
    render(<Harness initial={raw} />);
    const input = screen.getByRole('textbox', { name: '問1' });
    expect(screen.queryByText(/読み取り/)).not.toBeInTheDocument();
    fireEvent.blur(input);
    const output = screen.getByRole('status');
    expect(output).toHaveTextContent(normalized);
    const note = output.closest('p');
    expect(note?.id).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(note?.id);
    // 元の入力はそのまま保持する
    expect(input).toHaveValue(raw);
  });

  it('入力と正規化値が同じなら表示しない', () => {
    render(<Harness initial="1200" />);
    fireEvent.blur(screen.getByRole('textbox', { name: '問1' }));
    expect(screen.queryByText(/読み取り/)).not.toBeInTheDocument();
  });
});

describe('NumericField の補助文', () => {
  it('空欄では補助文も aria-invalid も出さない', () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: '問1' });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('負の値には補助文を付け、aria-describedby で結ぶ', () => {
    render(<Harness initial="-5" />);
    const input = screen.getByRole('textbox', { name: '問1' });
    const hint = screen.getByText('負の値になっています。計算を見直してください');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('数値として読めない入力は aria-invalid にして補助文を出す', () => {
    render(<Harness initial="abc" />);
    const input = screen.getByRole('textbox', { name: '問1' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const hint = screen.getByText('数値として読めません');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('readOnly のときは入力できない', () => {
    render(<Harness initial="12" readOnly />);
    const input = screen.getByRole('textbox', { name: '問1' });
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-readonly', 'true');
  });
});
