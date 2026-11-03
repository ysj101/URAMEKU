import { act, renderHook } from '@testing-library/react';
import { useDraft } from './useDraft';

describe('useDraft', () => {
  beforeEach(() => sessionStorage.clear());

  it('入力を sessionStorage に残し、同じ鍵で読み直せる', () => {
    const first = renderHook(() => useDraft('t', () => ({ reason: '' })));
    act(() => first.result.current[1]({ reason: 'a' }));
    first.unmount();
    const second = renderHook(() => useDraft('t', () => ({ reason: '' })));
    expect(second.result.current[0]).toEqual({ reason: 'a' });
  });

  it('forget は保存先だけ消して、今の値は保つ', () => {
    const { result } = renderHook(() => useDraft('t', () => ({ reason: '' })));
    act(() => result.current[1]({ reason: 'c' }));
    act(() => result.current[3]());
    expect(result.current[0]).toEqual({ reason: 'c' });
    expect(sessionStorage.getItem('urameku:draft:t')).toBeNull();
  });

  it('clear で消して初期値に戻る', () => {
    const { result } = renderHook(() => useDraft('t', () => ({ reason: '' })));
    act(() => result.current[1]((prev) => ({ ...prev, reason: 'b' })));
    act(() => result.current[2]());
    expect(result.current[0]).toEqual({ reason: '' });
    expect(sessionStorage.getItem('urameku:draft:t')).toBeNull();
  });
});
