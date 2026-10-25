import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../app/App';

// Retain the V1 keyboard regression against immutable content; active V2 has its own play tests.
vi.mock('../data/cases', async () => {
  const { LEGACY_CASES: cases } = await import('./legacyCases');
  return {
    CASES: cases,
    findCase: (id: string) => cases.find((c) => c.id === id),
    caseIndex: (id: string) => cases.findIndex((c) => c.id === id),
    nextCaseId: (id: string) => {
      const i = cases.findIndex((c) => c.id === id);
      return cases[i < 0 ? 0 : (i + 1) % cases.length]?.id;
    },
  };
});

/**
 * キーボードのみの統合テスト（MVP-039 / docs/TEST_STRATEGY.md T13）。
 * マウス（click）は一切使わず、Tab / Enter / Escape / 矢印キーだけで
 * ホーム → 事件一覧 → CASE 01 → 資料 → ピン留め → 照合 → 検証メモ → 記事 → 提出 → 結果 → 次の事件
 * まで到達できることと、各操作の後にフォーカスが body に落ちないことを確かめる。
 */

const user = userEvent.setup();

function active(): Element | null {
  return document.activeElement;
}

/** 各操作のあとに呼ぶ。フォーカスが body / null に落ちていないことを検査する */
function expectFocusKept(label: string) {
  const el = active();
  expect(el, `${label}: フォーカスが失われた`).not.toBeNull();
  expect(el, `${label}: フォーカスが body に落ちた`).not.toBe(document.body);
}

/** 目的の要素に届くまで Tab を押す。途中で body に落ちたら失敗 */
async function tabTo(target: HTMLElement, label = target.textContent ?? ''): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    await user.tab();
    expectFocusKept(`Tab → ${label}`);
    if (active() === target) return;
  }
  throw new Error(`Tab で「${label}」に到達できませんでした`);
}

async function pressEnter(label: string) {
  await user.keyboard('{Enter}');
  expectFocusKept(`Enter: ${label}`);
}

function dialogEl(): HTMLDialogElement {
  return document.querySelector('dialog.document-dialog') as HTMLDialogElement;
}

/** 資料タイルを開く → 「証拠ボードに貼る」で採用。ダイアログは閉じ、フォーカスはタイルに戻る */
async function openAndPin(titlePattern: RegExp) {
  const tile = screen.getByRole('button', { name: titlePattern });
  await tabTo(tile);
  await pressEnter(`資料を開く ${titlePattern}`);
  expect(dialogEl()).toHaveAttribute('open');
  // 開いた直後のフォーカスはダイアログの見出し
  expect(active()).toBe(dialogEl().querySelector('#dialog-title'));
  const pin = within(dialogEl()).getByRole('button', { name: '証拠ボードに貼る' });
  await tabTo(pin, '証拠ボードに貼る');
  await pressEnter('証拠ボードに貼る');
  expect(dialogEl()).not.toHaveAttribute('open');
  expect(active()).toBe(tile);
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

describe('V1互換UIをキーボードのみで完了できる（旧T13）', () => {
  it('ホーム → 事件一覧 → 調査 → 記事 → 提出 → 結果 → 次の事件', async () => {
    render(<App />);

    // --- ホーム → 事件一覧
    await tabTo(screen.getByRole('button', { name: /事件一覧/ }));
    await pressEnter('事件一覧');
    expect(window.location.hash).toBe('#/cases');
    // 遷移後は h1 にフォーカスが移り、aria-live で画面名が告知される
    expect(active()).toBe(screen.getByRole('heading', { level: 1, name: '事件一覧' }));
    expect(screen.getByText('事件一覧', { selector: '[aria-live="polite"]' })).toBeInTheDocument();

    // --- CASE 01 を開く
    await tabTo(screen.getByRole('button', { name: /CASE 01/ }), 'CASE 01');
    await pressEnter('CASE 01');
    expect(window.location.hash).toBe('#/play/case-01');
    expect(
      screen.getByRole('heading', { level: 1, name: '消えた55人の利用者' }),
    ).toBeInTheDocument();
    // 段階見出し（STEP 01）にフォーカスが移る
    expect(active()).toHaveTextContent('STEP 01');

    // --- 無料の資料を開いて Escape で閉じる（フォーカスはタイルに戻る）
    const adTile = screen.getByRole('button', { name: /キャンペーン広告/ });
    await tabTo(adTile, 'キャンペーン広告');
    await pressEnter('キャンペーン広告を開く');
    expect(dialogEl()).toHaveAttribute('open');
    await user.keyboard('{Escape}');
    expect(dialogEl()).not.toHaveAttribute('open');
    expect(active()).toBe(adTile);

    // --- 必要資料 3 枚を開いてピン留め
    await openAndPin(/無料体験者の登録台帳/);
    await openAndPin(/料金決済の集計/);
    await openAndPin(/翌月の継続状況/);
    expect(screen.getByText(/調査予算：残り 1 \/ 4/)).toBeInTheDocument();

    // --- 証拠ボードで 2 枚選択（A → B）
    await tabTo(
      screen.getByRole('button', { name: '無料体験者の登録台帳、未選択' }),
      'ボード: 登録台帳',
    );
    await pressEnter('ボード A');
    expect(active()).toHaveAttribute('aria-pressed', 'true');
    await tabTo(screen.getByRole('button', { name: '翌月の継続状況、未選択' }), 'ボード: 継続状況');
    await pressEnter('ボード B');
    expect(screen.getByTestId('link-status')).toHaveTextContent('照合候補（A ↔ B）');

    // --- 検証メモ（2 問）をキーボード入力
    const q1 = screen.getByRole('textbox', { name: '無料体験の登録者全体に対する翌月の継続率' });
    await tabTo(q1, '問 1');
    await user.keyboard('45');
    const q2 = screen.getByRole('textbox', { name: '有料契約に移行した人の翌月継続率' });
    await tabTo(q2, '問 2');
    await user.keyboard('90');
    expect(q1).toHaveValue('45');
    expect(q2).toHaveValue('90');

    // --- 記事画面へ（押したボタンは消えるが、フォーカスは STEP 02 の見出しへ移る）
    await tabTo(screen.getByRole('button', { name: '記事を組み立てる →' }));
    await pressEnter('記事を組み立てる');
    expect(active()).toHaveTextContent('STEP 02');

    // --- 断片 3 つを順に選ぶ
    for (const text of [
      '広告の継続率90%は',
      '有料契約者を分母にした数字',
      '体験登録者全体では45%が継続',
    ]) {
      await tabTo(screen.getByRole('button', { name: new RegExp(`^${text}`) }), text);
      await pressEnter(`断片 ${text}`);
    }
    expect(
      screen.getByRole('button', { name: /^断片 3: 体験登録者全体では45%が継続/ }),
    ).toBeInTheDocument();

    // --- 提出
    const submit = screen.getByRole('button', { name: '記事を提出して評価を見る' });
    expect(submit).not.toHaveAttribute('aria-disabled');
    await tabTo(submit);
    await pressEnter('提出');
    expect(active()).toHaveTextContent('STEP 03');
    expect(
      screen.getByRole('heading', { level: 2, name: '掲載可能な記事になりました！' }),
    ).toBeInTheDocument();

    // --- 次の事件へ
    await tabTo(screen.getByRole('button', { name: '次の事件へ' }));
    await pressEnter('次の事件へ');
    expect(window.location.hash).toBe('#/play/case-02');
    expect(screen.getByRole('heading', { level: 1, name: '半額セールの値札' })).toBeInTheDocument();
    expect(active()).toHaveTextContent('STEP 01');
  }, 30_000);
});

describe('スキップリンクと画面固有のキーボード操作', () => {
  it('スキップリンクは URL（ハッシュルート）を変えずに main へフォーカスを移す', async () => {
    render(<App />);
    await user.tab();
    expect(active()).toHaveTextContent('本編へ');
    await user.keyboard('{Enter}');
    expect(active()).toBe(screen.getByRole('main'));
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ウラメク');
  });

  it('遊び方のカルーセルは矢印キーで手順を移動できる（MVP-021）', async () => {
    render(<App />);
    await tabTo(screen.getByRole('button', { name: '調査をはじめる' }));
    await pressEnter('遊び方へ');
    expect(window.location.hash).toBe('#/tutorial');
    expect(active()).toBe(screen.getByRole('heading', { level: 1, name: '遊び方' }));
    const carousel = screen.getByRole('region', { name: '遊び方の手順' });
    await tabTo(carousel, 'カルーセル');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('group', { name: '手順 2 / 6' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('group', { name: '手順 1 / 6' })).toBeInTheDocument();
    expectFocusKept('カルーセル操作');
  });

  it('図鑑のタブは矢印キーで切り替わり、フォーカスも追従する（MVP-027）', async () => {
    render(<App />);
    await tabTo(screen.getByRole('button', { name: '図鑑' }));
    await pressEnter('図鑑へ');
    expect(active()).toBe(screen.getByRole('heading', { level: 1, name: '図鑑' }));
    const firstTab = screen.getByRole('tab', { name: '図鑑' });
    await tabTo(firstTab, 'タブ 図鑑');
    await user.keyboard('{ArrowRight}');
    const notebook = screen.getByRole('tab', { name: '事件手帳' });
    expect(active()).toBe(notebook);
    expect(notebook).toHaveAttribute('aria-selected', 'true');
    // タブリスト内の非選択タブは tabindex=-1（Tab 1 回でパネルへ抜ける）
    expect(firstTab).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(active()).toHaveAttribute('role', 'tabpanel');
  });

  it('設定画面では h1 にフォーカスが移り、ホームに戻ると再び h1 に移る', async () => {
    render(<App />);
    await tabTo(screen.getByRole('button', { name: '設定' }));
    await pressEnter('設定へ');
    expect(active()).toBe(screen.getByRole('heading', { level: 1, name: '設定' }));
    // 「← ホーム」は見出しの直前にあるので Shift+Tab 1 回で届く
    await user.tab({ shift: true });
    expect(active()).toBe(screen.getByRole('button', { name: '← ホーム' }));
    await pressEnter('ホームへ');
    expect(active()).toBe(screen.getByRole('heading', { level: 1 }));
    expect(active()).toHaveTextContent('ウラメク');
  });
});
