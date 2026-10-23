import { useCallback, useEffect, useState } from 'react';

/**
 * ハッシュベースの画面遷移。ブラウザの戻る/進むと URL 共有に対応し、
 * サブパス配信（MVP-004）でもサーバー設定を要しない。
 */
export const SCREENS = ['home', 'cases', 'play', 'tutorial', 'encyclopedia', 'settings'] as const;
export type Screen = (typeof SCREENS)[number];

export interface Route {
  screen: Screen;
  /** play 画面で開く事件 ID（省略時は保存中の事件） */
  caseId?: string;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  const [first, second] = raw.split('/');
  const screen = SCREENS.find((s) => s === first) ?? 'home';
  if (screen === 'play' && second) return { screen, caseId: second };
  return { screen };
}

export function toHash(route: Route): string {
  if (route.screen === 'home') return '#/';
  if (route.screen === 'play' && route.caseId) return `#/play/${route.caseId}`;
  return `#/${route.screen}`;
}

function currentRoute(): Route {
  if (typeof window === 'undefined') return { screen: 'home' };
  return parseHash(window.location.hash);
}

export interface Navigation {
  route: Route;
  navigate: (route: Route) => void;
  back: () => void;
}

export function useNavigation(): Navigation {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    const hash = toHash(next);
    if (window.location.hash === hash) {
      setRoute(next);
      return;
    }
    window.location.hash = hash;
    // hashchange は非同期なので即時反映もしておく
    setRoute(next);
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate({ screen: 'home' });
  }, [navigate]);

  return { route, navigate, back };
}
