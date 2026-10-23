import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StatusView } from './StatusView';
import { UI } from '../data/ui';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** 「再読み込み」の実装。既定は `window.location.reload()` */
  reload?: () => void;
  /** 「ホームへ戻る」の実装。既定は `location.hash = '#/'` */
  goHome?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** 子ツリーを作り直すためのキー。ホームへ戻るたびに増やす */
  epoch: number;
}

function formatError(error: Error): string {
  const head = `${error.name}: ${error.message}`;
  return error.stack && error.stack.includes(error.message)
    ? error.stack
    : `${head}\n${error.stack ?? ''}`;
}

/**
 * 描画エラーを捕捉し、`StatusView kind="error"` で回復手段を示す（MVP-028）。
 * 保存データには触れない（削除は設定画面からのみ）。
 * 「ホームへ戻る」はハッシュを `#/` にしてから子ツリーを再マウントする。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, epoch: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ウラメク] 描画エラー', error, info.componentStack);
  }

  private handleReload = () => {
    if (this.props.reload) this.props.reload();
    else window.location.reload();
  };

  private handleHome = () => {
    if (this.props.goHome) this.props.goHome();
    else window.location.hash = '#/';
    this.setState((s) => ({ error: null, epoch: s.epoch + 1 }));
  };

  render() {
    const { error, epoch } = this.state;
    if (error) {
      const text = UI.status.error;
      return (
        <StatusView
          kind="error"
          details={formatError(error)}
          actions={
            <>
              <button type="button" className="btn primary" onClick={this.handleReload}>
                {text.reload}
              </button>
              <button type="button" className="btn ghost" onClick={this.handleHome}>
                {text.home}
              </button>
            </>
          }
        />
      );
    }
    return (
      <div key={epoch} style={{ display: 'contents' }}>
        {this.props.children}
      </div>
    );
  }
}
