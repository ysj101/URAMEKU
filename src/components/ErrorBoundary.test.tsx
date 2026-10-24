import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import { UI } from '../data/ui';

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new TypeError('描画に失敗');
  return <p>正常な画面</p>;
}

/** モジュール変数で失敗を切り替える子（React は描画エラー時に一度再試行するため） */
let broken = true;
function Flaky() {
  if (broken) throw new Error('壊れている間は失敗');
  return <p>復旧した画面</p>;
}

/** jsdom が「未処理の例外」として出力するログを抑える（React が再スローするため） */
const swallow = (e: ErrorEvent) => e.preventDefault();

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeAll(() => window.addEventListener('error', swallow));
  afterAll(() => window.removeEventListener('error', swallow));
  beforeEach(() => {
    broken = true;
    window.location.hash = '#/settings';
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('エラーが無ければ子をそのまま描く', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常な画面')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('子の描画エラーを捕捉し、説明・回復ボタン・技術情報を出す', () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(UI.status.error.title);
    expect(alert).toHaveTextContent('記録は消えていません');
    expect(screen.getByRole('button', { name: UI.status.error.reload })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: UI.status.error.home })).toBeInTheDocument();
    expect(screen.getByText(UI.status.error.details).closest('details')).not.toBeNull();
    expect(screen.getByText(/TypeError: 描画に失敗/)).toBeInTheDocument();
    expect(screen.queryByText('正常な画面')).toBeNull();
  });

  it('「再読み込み」は reload を呼ぶ', () => {
    const reload = vi.fn();
    render(
      <ErrorBoundary reload={reload}>
        <Bomb explode />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: UI.status.error.reload }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('「ホームへ戻る」はハッシュを #/ にして子を再マウントし、保存データには触れない', () => {
    localStorage.setItem('urameku-test-keep', '1');
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: UI.status.error.home }));
    expect(window.location.hash).toBe('#/');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('復旧した画面')).toBeInTheDocument();
    expect(localStorage.getItem('urameku-test-keep')).toBe('1');
    localStorage.removeItem('urameku-test-keep');
  });
});
