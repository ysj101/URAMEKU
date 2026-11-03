import '@testing-library/jest-dom/vitest';

// 下書き（useDraft）やタブの記憶が別のテストに漏れないようにする
afterEach(() => {
  sessionStorage.clear();
});
