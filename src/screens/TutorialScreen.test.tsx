import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorialScreen } from './TutorialScreen';
import { CASES } from '../data/cases';

/** 練習のあとに開くのは一覧の先頭の事件 */
const FIRST_CASE_ID = CASES[0]!.id;
import case00 from '../../data/tutorial/case-00.json';
import { loadTutorialState } from '../state/tutorialState';
import type { Navigation } from '../app/navigation';
import type { StorageLike } from '../state/persistence';

function setup() {
  const map = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  const nav: Navigation = { route: { screen: 'tutorial' }, navigate: vi.fn(), back: vi.fn() };
  const game = { selectCase: vi.fn() };
  render(<TutorialScreen nav={nav} game={game} storage={storage} />);
  return { nav, game, storage, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;
async function chooseDrinks(user: User, initial = 'S', updated = 'L') {
  await user.click(screen.getByRole('radio', { name: new RegExp(`^${initial}サイズ`) }));
  await user.click(screen.getByRole('button', { name: 'これにする →' }));
  await user.click(screen.getByRole('radio', { name: new RegExp(`^${updated}サイズ`) }));
  await user.click(screen.getByRole('button', { name: '資料を開く →' }));
}
async function readDocuments(user: User) {
  if (screen.queryByRole('button', { name: 'これにする →' })) await chooseDrinks(user);
  for (const doc of case00.documents) {
    await user.click(screen.getByRole('button', { name: new RegExp(`${doc.title}を開く`) }));
    expect(screen.getByRole('article')).toHaveTextContent(doc.content.replace(/\s+/g, ' '));
  }
  await user.click(screen.getByRole('button', { name: '答えを選ぶ →' }));
}
async function choose(user: User, answerId: string, evidenceId: string) {
  const answer = case00.options.find((option) => option.id === answerId)!;
  const evidence = case00.excerpts.find((excerpt) => excerpt.id === evidenceId)!;
  await user.click(screen.getByRole('radio', { name: answer.text }));
  await user.click(screen.getByRole('radio', { name: new RegExp(evidence.quote) }));
  await user.click(screen.getByRole('button', { name: '報告をまとめる →' }));
}

describe('CASE00の体験チュートリアル', () => {
  it('最初の選択を記録してからMを見せ、資料や種明かしを先に見せない', async () => {
    const { user } = setup();
    expect(screen.getByText(case00.lead)).toHaveTextContent(
      'のどはかわいているけど、ポップコーン代も残しておきたい',
    );
    expect(screen.getByText(case00.experiment.initialPrompt)).toHaveTextContent(
      '直感で選んでください。あとで変えてもOKです。',
    );
    expect(screen.getByRole('button', { name: 'これにする →' })).toBeDisabled();
    expect(screen.queryByRole('radio', { name: /^Mサイズ/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: case00.openingTitle })).toBeInTheDocument();
    expect(screen.queryByText(case00.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText(/おとり|メニューが変わる|M追加|コラム/)).not.toBeInTheDocument();
    expect(screen.queryByText(case00.experiment.explanation)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /記録を開く/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^Sサイズ/ }));
    await user.click(screen.getByRole('button', { name: 'これにする →' }));
    expect(screen.getByText('最初に選んだのはSサイズでした。')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Mサイズ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '資料を開く →' })).toBeDisabled();
  });

  it.each([
    ['S', 'S'],
    ['S', 'M'],
    ['S', 'L'],
    ['L', 'S'],
    ['L', 'M'],
    ['L', 'L'],
  ])('%sから%sの選択でも完了し、好みの変化を診断しない', async (initial, updated) => {
    const { user } = setup();
    await chooseDrinks(user, initial, updated);
    await readDocuments(user);
    await choose(user, 'unchanged', 'staff_fact');
    expect(screen.getByRole('complementary', { name: 'ドリンク選びの記録' })).toHaveTextContent(
      `最初：${initial}サイズ`,
    );
    await user.click(screen.getByRole('button', { name: '報告する →' }));
    const learning = screen.getByRole('region', { name: 'おとり効果を学ぶ' });
    expect(learning).toHaveTextContent(
      initial === updated ? case00.experiment.unchanged : case00.experiment.changed,
    );
    expect(learning).toHaveTextContent(case00.experiment.limit);
    expect(learning).toHaveTextContent(`最初：${initial}サイズ`);
    expect(learning).toHaveTextContent(`M追加後：${updated}サイズ`);
    const column = screen.getByRole('region', { name: case00.column.title });
    for (const paragraph of case00.column.paragraphs) expect(column).toHaveTextContent(paragraph);
    for (const source of case00.column.sources) {
      expect(screen.getByRole('link', { name: source.title })).toHaveAttribute('href', source.url);
    }
    expect(screen.getByText('答えと根拠を、資料で確かめられました。')).toBeInTheDocument();
  });

  it('最初からやり直すと選択・調査・回答を消し、Mを隠したメニューに戻る', async () => {
    const { user } = setup();
    await readDocuments(user);
    await choose(user, 'unchanged', 'staff_fact');
    await user.click(screen.getByRole('button', { name: '報告する →' }));
    await user.click(screen.getByText('答え・根拠・詳しい解説'));
    await user.click(screen.getByRole('button', { name: '最初のメニューからやり直す' }));
    expect(screen.getByRole('button', { name: 'これにする →' })).toBeDisabled();
    expect(screen.queryByRole('radio', { name: /^Mサイズ/ })).not.toBeInTheDocument();
    await chooseDrinks(user);
    expect(screen.getByRole('status')).toHaveTextContent('資料確認 0 / 2');
  });

  it('各段階の次の操作を主ボタン1つで示す', async () => {
    const { user } = setup();
    const primary = (name: string) => {
      const buttons = screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('primary'));
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName(name);
    };
    primary('これにする →');
    await user.click(screen.getByRole('radio', { name: /^Sサイズ/ }));
    await user.click(screen.getByRole('button', { name: 'これにする →' }));
    primary('資料を開く →');
    await user.click(screen.getByRole('radio', { name: /^Lサイズ/ }));
    await user.click(screen.getByRole('button', { name: '資料を開く →' }));
    for (const [index, doc] of case00.documents.entries()) {
      primary(`資料 ${index + 1} / 未読${doc.title}を開く`);
      await user.click(screen.getByRole('button', { name: new RegExp(`${doc.title}を開く`) }));
    }
    primary('答えを選ぶ →');
    await user.click(screen.getByRole('button', { name: '答えを選ぶ →' }));
    primary('報告をまとめる →');
    await choose(user, 'unchanged', 'staff_fact');
    primary('報告する →');
    expect(screen.queryByRole('region', { name: case00.column.title })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '報告する →' }));
    primary('本編へ進む →');
  });

  it('2枚を読むまで先へ進めず、答えだけでも報告へ進めない', async () => {
    const { user } = setup();
    await chooseDrinks(user);
    expect(screen.queryByRole('button', { name: '答えを選ぶ →' })).not.toBeInTheDocument();
    const first = case00.documents[0]!;
    await user.click(screen.getByRole('button', { name: new RegExp(`${first.title}を開く`) }));
    await user.click(screen.getByRole('button', { name: new RegExp(`${first.title}を開く`) }));
    expect(screen.getByRole('status')).toHaveTextContent('資料確認 1 / 2');
    expect(screen.queryByRole('button', { name: '答えを選ぶ →' })).not.toBeInTheDocument();
    await readDocuments(user);
    expect(screen.getByRole('button', { name: '報告をまとめる →' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: case00.options[0]!.text }));
    expect(screen.getByRole('button', { name: '報告をまとめる →' })).toBeDisabled();
  });

  it('調査から提出・解説まで進み、提出した時だけ完了を保存する', async () => {
    const { user, nav, game, storage } = setup();
    await readDocuments(user);
    const answer = case00.options.find((option) => option.accepted)!;
    const evidence = case00.excerpts.find((excerpt) => excerpt.supportsAnswer)!;
    await choose(user, answer.id, evidence.id);
    expect(screen.getByText(answer.text)).toBeInTheDocument();
    expect(screen.getByText(evidence.quote)).toBeInTheDocument();
    expect(loadTutorialState(storage).completed).toBe(false);
    expect(screen.queryByText(case00.explanation)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '報告する →' }));
    expect(screen.getByText('CASE 00 調査完了')).toBeInTheDocument();
    expect(screen.getByText('答えと根拠を、資料で確かめられました。')).toBeInTheDocument();
    const image = screen.getByRole('img', { name: case00.visualGuide.imageAlt });
    expect(image).toHaveAttribute('src', expect.stringContaining(case00.visualGuide.image));
    expect(screen.getByText(case00.explanation)).not.toBeVisible();
    await user.click(screen.getByText('答え・根拠・詳しい解説'));
    expect(screen.getByText(case00.explanation)).toBeVisible();
    expect(screen.getByText(case00.limit)).toBeInTheDocument();
    expect(loadTutorialState(storage).completed).toBe(true);
    await user.click(screen.getByRole('button', { name: '本編へ進む →' }));
    expect(game.selectCase).toHaveBeenCalledWith(FIRST_CASE_ID);
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'play', caseId: FIRST_CASE_ID });
  });

  it('まちがった答えや根拠でも解説まで進め、資料を残して答え直せる', async () => {
    const { user } = setup();
    await readDocuments(user);
    await choose(user, 'discount', 'menu_fact');
    await user.click(screen.getByRole('button', { name: '← 答えを見直す' }));
    expect(screen.getByRole('radio', { name: case00.options[0]!.text })).toBeChecked();
    await user.click(screen.getByRole('button', { name: '報告をまとめる →' }));
    await user.click(screen.getByRole('button', { name: '報告する →' }));
    await user.click(screen.getByText('答え・根拠・詳しい解説'));
    expect(screen.getByText(/2枚のメニューを見直しましょう/)).toBeInTheDocument();
    expect(
      screen.getByText(/飲み物の種類だけでは、価格と量の変化は分かりません/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'もう一度答える' }));
    await user.click(screen.getByRole('button', { name: '← 資料を読み直す' }));
    expect(screen.getByRole('status')).toHaveTextContent('資料確認 2 / 2');
    await user.click(screen.getByRole('button', { name: '答えを選ぶ →' }));
    await choose(user, 'unchanged', 'staff_fact');
    await user.click(screen.getByRole('button', { name: '報告する →' }));
    expect(screen.getByText('答えと根拠を、資料で確かめられました。')).toBeInTheDocument();
  });

  it('答えが合っていても根拠が違えば、確認できた扱いにしない', async () => {
    const { user } = setup();
    await readDocuments(user);
    await choose(user, 'unchanged', 'menu_fact');
    await user.click(screen.getByRole('button', { name: '報告する →' }));
    expect(screen.queryByText('答えと根拠を、資料で確かめられました。')).not.toBeInTheDocument();
    expect(
      screen.getByText(/飲み物の種類だけでは、価格と量の変化は分かりません/),
    ).toBeInTheDocument();
  });

  it('途中で一覧に移動しても完了扱いにしない', async () => {
    const { user, nav, storage } = setup();
    await user.click(screen.getByRole('button', { name: '練習をやめて事件一覧へ' }));
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'cases' });
    expect(loadTutorialState(storage).completed).toBe(false);
  });

  it('メニューの価格と量が資料に一致し、MとLは同額でLの量が多い', () => {
    const { items, initial, updated } = case00.experiment;
    expect(initial).toEqual(['s', 'l']);
    expect(updated).toEqual(['s', 'm', 'l']);
    const medium = items.find((item) => item.id === 'm')!;
    const large = items.find((item) => item.id === 'l')!;
    expect(medium.price).toBe(large.price);
    expect(medium.volume).toBeLessThan(large.volume);
    for (const item of items) {
      expect(case00.documents[0]!.content).toContain(
        `${item.label}は${item.price}円で${item.volume}mL`,
      );
    }
  });

  it('コラムは研究と受賞理由を区別する', () => {
    const text = case00.column.paragraphs.join('');
    expect(text).toContain('Huber、Payne、Putoは、1982年');
    expect(text).toContain('心理学で分かったことを経済学に取り入れた分野');
    expect(text).toMatch(
      /カーネマンは、心理学の研究を経済学に取り入れた功績で、2002年にノーベル経済学賞/,
    );
    expect(text).toContain('先のことが分からない中での判断や選択');
    expect(text).toContain('セイラーは、行動経済学への貢献で、2017年');
    expect(text).toContain('おとり効果そのものが受賞したわけではありません。');
  });

  it('根拠の引用は資料本文に実在し、答えと根拠がそろっている', () => {
    expect(case00.options.filter((option) => option.accepted)).toHaveLength(1);
    expect(case00.excerpts.filter((excerpt) => excerpt.supportsAnswer)).toHaveLength(1);
    for (const excerpt of case00.excerpts) {
      const doc = case00.documents.find((entry) => entry.id === excerpt.documentId);
      expect(doc?.content).toContain(excerpt.quote);
    }
  });
});
