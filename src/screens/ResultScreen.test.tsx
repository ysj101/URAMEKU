// jsdom には AnimationEvent が無く、React DOM は読み込み時に存在を見て
// 購読するイベント名を決めるため、import より前に定義しておく（Stamp.test と同じ）。
const { playMock } = vi.hoisted(() => {
  if (!('AnimationEvent' in window)) {
    (window as unknown as { AnimationEvent: typeof Event }).AnimationEvent = class extends Event {};
  }
  return { playMock: vi.fn() };
});
vi.mock('../audio/useSound', () => ({ useSound: () => playMock }));

import { fireEvent, render, screen, within } from '@testing-library/react';
import { ResultScreen } from './ResultScreen';
import type { GameApi } from '../state/useGame';
import type { Navigation } from '../app/navigation';
import type { CaseData, CaseProgress } from '../domain/types';
import { UI } from '../data/ui';
import { clearedProgress, makeCase } from '../test/fixtures';

const caseA = makeCase({ id: 'case-98', title: '事件A' });
const caseB = makeCase({ id: 'case-99', title: '事件B' });

/** useGame をモックせず、GameApi 型のスタブを渡す */
function makeGame(progress: CaseProgress, current: CaseData = caseA): GameApi {
  return {
    cases: [caseA, caseB],
    current,
    progress,
    stage: 'article',
    finished: {},
    dispatch: vi.fn(),
    selectCase: vi.fn(),
    setStage: vi.fn(),
    goToNextCase: vi.fn(),
    resetAll: vi.fn(),
  };
}

function makeNav(): Navigation {
  return { route: { screen: 'play', caseId: caseA.id }, navigate: vi.fn(), back: vi.fn() };
}

beforeEach(() => {
  playMock.mockClear();
});

describe('ResultScreen（合格時）', () => {
  it('判子と評価点・配点表・編集後記を出し、差し戻し理由と正解は出さない', () => {
    render(<ResultScreen game={makeGame(clearedProgress())} nav={makeNav()} />);
    expect(screen.getByRole('img', { name: '掲載可' })).toBeInTheDocument();
    expect(screen.getByText('掲載可能な記事になりました！')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '配点の内訳' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '差し戻しの理由' })).not.toBeInTheDocument();
    expect(screen.queryByText('答え合わせ')).not.toBeInTheDocument();
    // 編集後記（見出しは bias）
    const debrief = screen.getByRole('region', { name: /テスト/ });
    expect(within(debrief).getByText('説明文です。十分な長さがあります。')).toBeInTheDocument();
    expect(within(debrief).getByText(/持ち帰る視点です。/)).toBeInTheDocument();
  });

  it('評価ランクは文字で出し、点数が事件内の達成度である旨を添える', () => {
    render(<ResultScreen game={makeGame(clearedProgress())} nav={makeNav()} />);
    // clearedProgress は 3 資料で予算 3 を使い切る → 94 点 = A
    expect(screen.getByText(/94 \/ 100/)).toBeInTheDocument();
    expect(screen.getByLabelText('評価ランク A')).toBeInTheDocument();
    expect(screen.getByText(/プレイヤーの評価ではなく/)).toBeInTheDocument();
  });

  it('事件の disclaimer と非診断の注記を必ず表示する', () => {
    render(<ResultScreen game={makeGame(clearedProgress())} nav={makeNav()} />);
    expect(screen.getByTestId('case-disclaimer')).toHaveTextContent('架空です。');
    expect(screen.getByText(new RegExp(UI.notices.notDiagnosis))).toBeInTheDocument();
  });

  it('判子が押されたら case-complete を 1 回だけ鳴らし、本文を表示する', () => {
    render(<ResultScreen game={makeGame(clearedProgress())} nav={makeNav()} />);
    const stamp = screen.getByRole('img', { name: '掲載可' });
    expect(playMock).not.toHaveBeenCalled();
    fireEvent.animationEnd(stamp);
    fireEvent.animationEnd(stamp);
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledWith('case-complete');
    expect(document.querySelector('.result')).toHaveAttribute('data-settled', 'true');
  });

  it('「次の事件へ」で次の事件に進み、play 画面へ遷移する', () => {
    const game = makeGame(clearedProgress(), caseA);
    const nav = makeNav();
    render(<ResultScreen game={game} nav={nav} />);
    fireEvent.click(screen.getByRole('button', { name: '次の事件へ' }));
    expect(game.goToNextCase).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'play', caseId: caseB.id });
  });

  it('最後の事件なら「事件一覧へ」になり、一覧へ遷移する', () => {
    const game = makeGame(clearedProgress(), caseB);
    const nav = makeNav();
    render(<ResultScreen game={game} nav={nav} />);
    expect(screen.queryByRole('button', { name: '次の事件へ' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '事件一覧へ' }));
    expect(game.goToNextCase).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith({ screen: 'cases' });
  });
});

describe('ResultScreen（差し戻し時）', () => {
  const rejected = (): CaseProgress => ({
    ...clearedProgress(),
    opened: ['a', 'b'],
    chosenLink: ['a', 'b'],
  });

  it('不足種別だけを列挙し、正解は公開操作まで伏せる', () => {
    const game = makeGame(rejected());
    render(<ResultScreen game={game} nav={makeNav()} />);
    expect(screen.getByRole('img', { name: '要再調査' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: '差し戻しの理由' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('必要な裏付け資料が 1 件足りません');
    expect(items[1]).toHaveTextContent('2 資料の照合が成立していません');
    // 他系統の理由は混ざらない
    expect(screen.queryByText(/数値検証メモに/)).not.toBeInTheDocument();
    expect(screen.queryByText(/見出しの断片/)).not.toBeInTheDocument();
    // 正解（資料名・照合・断片の理由）は公開前には出ない
    expect(screen.queryByText(/資料C/)).not.toBeInTheDocument();
    expect(screen.queryByText('答え合わせ')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '見出し断片の採点' })).not.toBeInTheDocument();
    // 合格時の要素も出ない
    expect(screen.queryByLabelText(/評価ランク/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '次の事件へ' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '解説と正解を公開する' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'reveal' });
  });

  it('差し戻しの判子で incorrect を 1 回だけ鳴らす', () => {
    render(<ResultScreen game={makeGame(rejected())} nav={makeNav()} />);
    const stamp = screen.getByRole('img', { name: '要再調査' });
    fireEvent.animationEnd(stamp);
    fireEvent.animationEnd(stamp);
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(playMock).toHaveBeenCalledWith('incorrect');
  });

  it('「記事を修正する」は取り下げて記事段階へ、「調査へ戻る」は取り下げて調査段階へ', () => {
    const game = makeGame(rejected());
    render(<ResultScreen game={game} nav={makeNav()} />);
    fireEvent.click(screen.getByRole('button', { name: '記事を修正する' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'withdraw' });
    expect(game.setStage).toHaveBeenCalledWith('article');

    fireEvent.click(screen.getByRole('button', { name: '調査へ戻る' }));
    expect(game.dispatch).toHaveBeenCalledTimes(2);
    expect(game.setStage).toHaveBeenLastCalledWith('investigate');
  });

  it('公開済みなら答え合わせと断片ごとの理由・編集後記・disclaimer を表示する', () => {
    const caseWithReasons = makeCase({
      id: 'case-98',
      headline_fragments: [
        { id: 'f0', text: '断片0', kind: 'correct', reason: '正しい主語。' },
        { id: 'f1', text: '断片1', kind: 'correct', reason: '分母が明示されている。' },
        { id: 'f2', text: '断片2', kind: 'correct', reason: '結論を限定している。' },
        {
          id: 'f3',
          text: '断片3',
          kind: 'causal-claim',
          reason: '資料に無い原因を断定している。',
          evidence: ['c'],
        },
      ],
    });
    const game = makeGame(
      { ...rejected(), article: ['f0', 'f3', 'f1'], revealed: true },
      caseWithReasons,
    );
    render(<ResultScreen game={game} nav={makeNav()} />);
    expect(screen.getByText('答え合わせ')).toBeInTheDocument();
    expect(screen.getByText(/資料A、資料B、資料C/)).toBeInTheDocument();
    expect(screen.getByText('資料A ↔ 資料C')).toBeInTheDocument();
    expect(screen.getByText('問1：45%')).toBeInTheDocument();
    expect(screen.getByText('断片0 ／ 断片1 ／ 断片2')).toBeInTheDocument();

    const slots = within(screen.getByRole('list', { name: '見出し断片の採点' })).getAllByRole(
      'listitem',
    );
    expect(slots).toHaveLength(3);
    expect(slots[0]).toHaveAttribute('data-status', 'correct');
    expect(slots[0]).toHaveTextContent('正しい主語。');
    expect(slots[1]).toHaveAttribute('data-status', 'incorrect');
    expect(slots[1]).toHaveTextContent('原因・結論の断定');
    expect(slots[1]).toHaveTextContent('資料に無い原因を断定している。');
    expect(slots[1]).toHaveTextContent('根拠：資料C');
    expect(slots[2]).toHaveAttribute('data-status', 'wrong-position');

    // 公開ボタンは消え、編集後記と disclaimer が出る
    expect(screen.queryByRole('button', { name: '解説と正解を公開する' })).not.toBeInTheDocument();
    expect(screen.getByText('説明文です。十分な長さがあります。')).toBeInTheDocument();
    expect(screen.getByTestId('case-disclaimer')).toHaveTextContent('架空です。');
    expect(screen.getByText(new RegExp(UI.notices.notDiagnosis))).toBeInTheDocument();
  });
});

describe('ResultScreen（やり直し）', () => {
  it('window.confirm を使わず 2 段階で確認し、やめるで戻れる', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const game = makeGame(clearedProgress());
    render(<ResultScreen game={game} nav={makeNav()} />);

    fireEvent.click(screen.getByRole('button', { name: 'この事件をもう一度' }));
    expect(game.dispatch).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'やり直しの確認' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'やめる' }));
    expect(screen.queryByRole('group', { name: 'やり直しの確認' })).not.toBeInTheDocument();
    expect(game.dispatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'この事件をもう一度' }));
    fireEvent.click(screen.getByRole('button', { name: 'やり直す' }));
    expect(game.dispatch).toHaveBeenCalledWith({ type: 'reset' });
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
