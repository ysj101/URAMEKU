import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIRST_CASE_ID, TutorialScreen } from './TutorialScreen';
import { UI } from '../data/ui';
import { TUTORIAL_STEPS } from '../data/assets';
import { loadTutorialState } from '../state/tutorialState';
import type { Navigation } from '../app/navigation';
import type { StorageLike } from '../state/persistence';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function setup() {
  const nav: Navigation = { route: { screen: 'tutorial' }, navigate: vi.fn(), back: vi.fn() };
  const game = { selectCase: vi.fn() };
  const storage = memoryStorage();
  render(<TutorialScreen nav={nav} game={game} storage={storage} />);
  return { nav, game, storage, user: userEvent.setup() };
}

const slide = () => screen.getByRole('group');
const stepHeading = (n: number) =>
  screen.getByRole('heading', { level: 2, name: UI.tutorial.steps[n - 1]!.title });

describe('TutorialScreen', () => {
  it('文言は 6 ステップぶんあり、画像は本文テキストと対で表示される', () => {
    expect(UI.tutorial.steps).toHaveLength(TUTORIAL_STEPS.length);
    setup();
    const region = screen.getByRole('region', { name: UI.tutorial.carouselLabel });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    expect(slide()).toHaveAttribute('aria-roledescription', 'slide');
    expect(slide()).toHaveAccessibleName('手順 1 / 6');
    expect(stepHeading(1)).toBeInTheDocument();
    expect(screen.getByText(UI.tutorial.steps[0]!.body)).toBeInTheDocument();
    const img = slide().querySelector('img');
    expect(img).toHaveAttribute('src', '/assets/tutorial/step-01.png');
    expect(img).toHaveAttribute('alt', '');
    expect(screen.getByRole('button', { name: '手順 1 / 6' })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('前へ / 次へ で移動し、端では前へが無効', async () => {
    const { user } = setup();
    expect(screen.getByRole('button', { name: UI.tutorial.prev })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: UI.tutorial.next }));
    expect(slide()).toHaveAccessibleName('手順 2 / 6');
    expect(stepHeading(2)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '手順 2 / 6' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('button', { name: '手順 1 / 6' })).not.toHaveAttribute('aria-current');
    expect(slide().querySelector('img')).toHaveAttribute('src', '/assets/tutorial/step-02.png');
    await user.click(screen.getByRole('button', { name: UI.tutorial.prev }));
    expect(slide()).toHaveAccessibleName('手順 1 / 6');
  });

  it('矢印キーで移動し、番号ボタンで直接ジャンプできる', async () => {
    const { user } = setup();
    screen.getByRole('region', { name: UI.tutorial.carouselLabel }).focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(slide()).toHaveAccessibleName('手順 3 / 6');
    await user.keyboard('{ArrowLeft}');
    expect(slide()).toHaveAccessibleName('手順 2 / 6');
    await user.keyboard('{End}');
    expect(slide()).toHaveAccessibleName('手順 6 / 6');
    await user.keyboard('{ArrowRight}');
    expect(slide()).toHaveAccessibleName('手順 6 / 6');
    await user.keyboard('{Home}');
    expect(slide()).toHaveAccessibleName('手順 1 / 6');
    await user.click(screen.getByRole('button', { name: '手順 5 / 6' }));
    expect(stepHeading(5)).toBeInTheDocument();
  });

  it('最後の手順で「CASE 01 を始める」→ 事件選択と play への遷移、完了が保存される', async () => {
    const { user, nav, game, storage } = setup();
    expect(screen.queryByRole('button', { name: UI.tutorial.start })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '手順 6 / 6' }));
    expect(screen.queryByRole('button', { name: UI.tutorial.next })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: UI.tutorial.start }));
    expect(game.selectCase).toHaveBeenCalledWith(FIRST_CASE_ID);
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'play', caseId: FIRST_CASE_ID });
    expect(loadTutorialState(storage).completed).toBe(true);
    expect(loadTutorialState(storage).hintsEnabled).toBe(true);
  });

  it('スキップで事件一覧へ遷移し、完了が保存される', async () => {
    const { user, nav, storage } = setup();
    await user.click(screen.getByRole('button', { name: UI.tutorial.skip }));
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'cases' });
    expect(loadTutorialState(storage).completed).toBe(true);
  });

  it('game が無くても（App の接続どおり）遷移できる', async () => {
    const nav: Navigation = { route: { screen: 'tutorial' }, navigate: vi.fn(), back: vi.fn() };
    render(<TutorialScreen nav={nav} storage={memoryStorage()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '手順 6 / 6' }));
    await user.click(screen.getByRole('button', { name: UI.tutorial.start }));
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'play', caseId: FIRST_CASE_ID });
    await user.click(screen.getByRole('button', { name: '← ホーム' }));
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'home' });
  });
});
