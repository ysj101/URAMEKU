import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIRST_CASE_ID, TutorialScreen } from './TutorialScreen';
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
  await user.click(screen.getByRole('button', { name: 'このサイズにする →' }));
  await user.click(screen.getByRole('radio', { name: new RegExp(`^${updated}サイズ`) }));
  await user.click(screen.getByRole('button', { name: '選んで資料を調べる →' }));
}
async function readDocuments(user: User) {
  if (screen.queryByRole('button', { name: 'このサイズにする →' })) await chooseDrinks(user);
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
    expect(screen.getByRole('button', { name: 'このサイズにする →' })).toBeDisabled();
    expect(screen.queryByRole('radio', { name: /^Mサイズ/ })).not.toBeInTheDocument();
    expect(screen.queryByText(case00.experiment.explanation)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /記録を開く/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^Sサイズ/ }));
    await user.click(screen.getByRole('button', { name: 'このサイズにする →' }));
    expect(screen.getByText('最初に選んだのはSサイズでした。')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Mサイズ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '選んで資料を調べる →' })).toBeDisabled();
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
    await user.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
    const learning = screen.getByRole('region', { name: 'おとり効果を学ぶ' });
    expect(learning).toHaveTextContent(
      initial === updated ? case00.experiment.unchanged : case00.experiment.changed,
    );
    expect(learning).toHaveTextContent(case00.experiment.limit);
    expect(screen.getByText('答えと根拠を、資料で確かめられました。')).toBeInTheDocument();
  });

  it('最初からやり直すと選択・調査・回答を消し、Mを隠したメニューに戻る', async () => {
    const { user } = setup();
    await readDocuments(user);
    await choose(user, 'unchanged', 'staff_fact');
    await user.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
    await user.click(screen.getByText('答え・根拠・詳しい解説'));
    await user.click(screen.getByRole('button', { name: '最初のメニューからやり直す' }));
    expect(screen.getByRole('button', { name: 'このサイズにする →' })).toBeDisabled();
    expect(screen.queryByRole('radio', { name: /^Mサイズ/ })).not.toBeInTheDocument();
    await chooseDrinks(user);
    expect(screen.getByRole('status')).toHaveTextContent('資料確認 0 / 2');
  });

  it('2枚を読むまで先へ進めず、答えだけでも報告へ進めない', async () => {
    const { user } = setup();
    await chooseDrinks(user);
    expect(screen.getByRole('button', { name: '答えを選ぶ →' })).toBeDisabled();
    const first = case00.documents[0]!;
    await user.click(screen.getByRole('button', { name: new RegExp(`${first.title}を開く`) }));
    await user.click(screen.getByRole('button', { name: new RegExp(`${first.title}を開く`) }));
    expect(screen.getByRole('status')).toHaveTextContent('資料確認 1 / 2');
    expect(screen.getByRole('button', { name: '答えを選ぶ →' })).toBeDisabled();
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
    await user.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
    expect(screen.getByText('CASE 00 調査完了')).toBeInTheDocument();
    expect(screen.getByText('答えと根拠を、資料で確かめられました。')).toBeInTheDocument();
    const image = screen.getByRole('img', { name: case00.visualGuide.imageAlt });
    expect(image).toHaveAttribute('src', expect.stringContaining(case00.visualGuide.image));
    expect(screen.getByText(case00.explanation)).not.toBeVisible();
    await user.click(screen.getByText('答え・根拠・詳しい解説'));
    expect(screen.getByText(case00.explanation)).toBeVisible();
    expect(screen.getByText(case00.limit)).toBeInTheDocument();
    expect(loadTutorialState(storage).completed).toBe(true);
    await user.click(screen.getByRole('button', { name: 'CASE 01 を始める' }));
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
    await user.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
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
    await user.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
    expect(screen.getByText('答えと根拠を、資料で確かめられました。')).toBeInTheDocument();
  });

  it('答えが合っていても根拠が違えば、確認できた扱いにしない', async () => {
    const { user } = setup();
    await readDocuments(user);
    await choose(user, 'unchanged', 'menu_fact');
    await user.click(screen.getByRole('button', { name: '報告を提出して振り返る' }));
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

  it('根拠の引用は資料本文に実在し、答えと根拠がそろっている', () => {
    expect(case00.options.filter((option) => option.accepted)).toHaveLength(1);
    expect(case00.excerpts.filter((excerpt) => excerpt.supportsAnswer)).toHaveLength(1);
    for (const excerpt of case00.excerpts) {
      const doc = case00.documents.find((entry) => entry.id === excerpt.documentId);
      expect(doc?.content).toContain(excerpt.quote);
    }
  });
});
