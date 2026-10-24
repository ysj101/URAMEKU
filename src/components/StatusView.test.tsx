import { fireEvent, render, screen } from '@testing-library/react';
import { OfflineBanner, StatusView, type StatusKind } from './StatusView';
import { UI } from '../data/ui';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PUBLIC_ASSETS = resolve(__dirname, '../../public/assets');

describe('StatusView', () => {
  it.each<[StatusKind, string]>([
    ['loading', UI.status.loading.title],
    ['empty', UI.status.empty.title],
    ['offline', UI.status.offline.title],
    ['error', UI.status.error.title],
    ['save-failed', UI.status.saveFailed.title],
    ['save-unavailable', UI.status.saveUnavailable.title],
  ])('%s は専用の見出しと説明を出す', (kind, title) => {
    render(<StatusView kind={kind} />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(UI.status[keyOf(kind)].body)).toBeInTheDocument();
  });

  it('loading は role=status と aria-busy を持ち、挿絵は出さない', () => {
    const { container } = render(<StatusView kind="loading" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('img')).toBeNull();
  });

  it('error は role=alert で、技術情報を details に折りたたむ', () => {
    render(<StatusView kind="error" details="TypeError: boom" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const details = screen.getByText(UI.status.error.details).closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('TypeError: boom')).toBeInTheDocument();
  });

  it.each<[StatusKind, string]>([
    ['empty', 'empty'],
    ['offline', 'offline'],
    ['error', 'error'],
    ['save-failed', 'error'],
    ['save-unavailable', 'locked'],
  ])('%s の挿絵 %s は実在する画像を指す', (kind, name) => {
    const { container } = render(<StatusView kind={kind} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(`/assets/ui/illustrations/${name}.svg`);
    expect(existsSync(resolve(PUBLIC_ASSETS, `ui/illustrations/${name}.svg`))).toBe(true);
    expect(img).toHaveAttribute('alt', '');
  });

  it('見出し・説明・回復ボタンを差し替えられる', () => {
    const onRetry = vi.fn();
    render(
      <StatusView
        kind="empty"
        title="図鑑はまだ空です"
        body="事件を解決すると項目が増えます"
        illustration="complete"
        actions={
          <button type="button" onClick={onRetry}>
            事件一覧へ
          </button>
        }
      />,
    );
    expect(screen.getByRole('heading', { name: '図鑑はまだ空です' })).toBeInTheDocument();
    expect(screen.getByText('事件を解決すると項目が増えます')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '事件一覧へ' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}
function goOffline() {
  setOnLine(false);
  fireEvent(window, new Event('offline'));
}
function goOnline() {
  setOnLine(true);
  fireEvent(window, new Event('online'));
}

describe('OfflineBanner', () => {
  afterEach(() => setOnLine(true));

  it('オンラインなら何も出さない', () => {
    setOnLine(true);
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('オフラインなら role=status で説明と回復方法を出し、閉じられる', () => {
    setOnLine(false);
    render(<OfflineBanner />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(UI.states.offline);
    expect(banner).toHaveTextContent('接続後に再読み込み');
    fireEvent.click(screen.getByRole('button', { name: UI.status.offline.dismiss }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('online / offline イベントに追従する', () => {
    setOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();
    goOffline();
    expect(screen.getByRole('status')).toBeInTheDocument();
    goOnline();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('閉じたあと、接続が戻って再びオフラインになったら再表示する', () => {
    setOnLine(false);
    render(<OfflineBanner />);
    fireEvent.click(screen.getByRole('button', { name: UI.status.offline.dismiss }));
    expect(screen.queryByRole('status')).toBeNull();
    // 接続が戻る前にもう一度 offline が飛んできても再表示しない
    goOffline();
    expect(screen.queryByRole('status')).toBeNull();
    goOnline();
    expect(screen.queryByRole('status')).toBeNull();
    goOffline();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

function keyOf(kind: StatusKind): keyof typeof UI.status {
  switch (kind) {
    case 'save-failed':
      return 'saveFailed';
    case 'save-unavailable':
      return 'saveUnavailable';
    default:
      return kind;
  }
}
