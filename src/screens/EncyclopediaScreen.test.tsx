import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EncyclopediaScreen } from './EncyclopediaScreen';
import { CASES } from '../data/cases';
import { ENCYCLOPEDIA } from '../data/encyclopedia';
import { createProgress } from '../domain/game';
import type { GameApi } from '../state/useGame';
import type { Navigation } from '../app/navigation';

function api(overrides: Partial<GameApi> = {}): GameApi {
  return {
    cases: CASES,
    current: CASES[0]!,
    progress: createProgress(),
    stage: 'investigate',
    finished: {},
    progressByCase: {},
    dispatch: vi.fn(),
    selectCase: vi.fn(),
    setStage: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
    ...overrides,
  };
}

const nav: Navigation = { route: { screen: 'encyclopedia' }, navigate: vi.fn(), back: vi.fn() };

/** 個人を分類・評価する表現が画面に出ていないこと */
function expectNoDiagnosisWording() {
  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/あなたは/);
  expect(text).not.toMatch(/タイプ/);
  expect(text).not.toMatch(/性格/);
  // 「診断」は否定文（notDiagnosis）としてのみ現れる
  expect(text.replace(/診断するものではありません/g, '')).not.toMatch(/診断/);
}

describe('EncyclopediaScreen: 図鑑タブ', () => {
  it('未解決のときは概念名・要約・注記を一切出さず、解放条件だけ出す', () => {
    render(<EncyclopediaScreen game={api()} nav={nav} />);
    for (const e of ENCYCLOPEDIA) {
      expect(screen.queryByText(e.title)).not.toBeInTheDocument();
      expect(screen.queryByText(e.summary)).not.toBeInTheDocument();
    }
    expect(screen.getAllByText('CASE 01 を解決すると追加')).toHaveLength(1);
    expect(screen.getAllByText(/CASE 0\d を解決すると追加/)).toHaveLength(ENCYCLOPEDIA.length);
    expect(screen.getByText(`解放済み 0 / ${ENCYCLOPEDIA.length}`)).toBeInTheDocument();
    expectNoDiagnosisWording();
  });

  it('解決した事件の項目だけ本文と注記（disclaimer）が出る', () => {
    const first = ENCYCLOPEDIA.find((e) => e.unlockCase === 'case-01')!;
    render(<EncyclopediaScreen game={api({ finished: { 'case-01': true } })} nav={nav} />);
    expect(screen.getByRole('heading', { level: 3, name: first.title })).toBeInTheDocument();
    expect(screen.getByText(first.summary)).toBeInTheDocument();
    expect(screen.getAllByText(first.disclaimer).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('CASE 01 を解決すると追加')).not.toBeInTheDocument();
    // 他は未解放のまま
    for (const e of ENCYCLOPEDIA.filter((x) => x.id !== first.id)) {
      expect(screen.queryByText(e.title)).not.toBeInTheDocument();
    }
    expect(screen.getByText(`解放済み 1 / ${ENCYCLOPEDIA.length}`)).toBeInTheDocument();
    expectNoDiagnosisWording();
  });

  it('提出済みでも合格でなければ（finished に無ければ）解放しない', () => {
    render(
      <EncyclopediaScreen
        game={api({
          finished: { 'case-01': false },
          progressByCase: { 'case-01': { ...createProgress(), published: true } },
        })}
        nav={nav}
      />,
    );
    for (const e of ENCYCLOPEDIA) expect(screen.queryByText(e.title)).not.toBeInTheDocument();
  });
});

describe('EncyclopediaScreen: タブ', () => {
  it('role=tablist で、矢印キーで移動し選択パネルだけ表示する', async () => {
    const user = userEvent.setup();
    render(<EncyclopediaScreen game={api()} nav={nav} />);
    const tabs = screen.getAllByRole('tab');
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');

    tabs[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: '事件手帳' })).toBeVisible();
    expect(screen.queryByText(/解決すると追加/)).not.toBeInTheDocument();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: '実績' })).toBeVisible();

    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
  });
});

describe('EncyclopediaScreen: 事件手帳タブ', () => {
  it('事件ごとに状態と使用予算を出し、診断表現を置かない', async () => {
    const user = userEvent.setup();
    const c1 = CASES[0]!;
    render(
      <EncyclopediaScreen
        game={api({
          finished: { 'case-01': true },
          progressByCase: {
            'case-01': { ...createProgress(), opened: ['ad', 'trial', 'paid'], published: true },
            'case-02': { ...createProgress(), opened: [c1.documents[0]!.id] },
          },
        })}
        nav={nav}
      />,
    );
    await user.click(screen.getByRole('tab', { name: '事件手帳' }));
    // case-01: ad(0) + trial(1) + paid(1) = 2 / 4
    expect(screen.getByLabelText('調査予算 2 / 4')).toHaveTextContent('2 / 4');
    expect(screen.getByText('解決')).toBeInTheDocument();
    expect(screen.getAllByText('未着手').length).toBeGreaterThanOrEqual(3);
    // 提出回数は保存していないので出さない
    expect(screen.queryByText(/提出回数/)).not.toBeInTheDocument();
    expect(screen.getAllByText('少数の選択から心理特性を診断するものではありません。').length).toBe(
      2,
    );
    expectNoDiagnosisWording();
  });
});

describe('EncyclopediaScreen: 実績タブ', () => {
  it('5 件を取得 / 未取得で出す', async () => {
    const user = userEvent.setup();
    render(
      <EncyclopediaScreen
        game={api({ progressByCase: { 'case-01': { ...createProgress(), pinned: ['ad'] } } })}
        nav={nav}
      />,
    );
    await user.click(screen.getByRole('tab', { name: '実績' }));
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows.filter((r) => r.dataset.achievementState === 'earned')).toHaveLength(1);
    expect(screen.getByText('最初の証拠').closest('li')).toHaveAttribute(
      'data-achievement-state',
      'earned',
    );
    expect(screen.getAllByText('未取得')).toHaveLength(4);
    expect(document.querySelectorAll('img.achievement-icon')).toHaveLength(5);
    expectNoDiagnosisWording();
  });
});
