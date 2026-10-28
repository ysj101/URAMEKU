import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorialHint } from './TutorialHint';
import { hintFor } from './hintSelector';
import { UI } from '../data/ui';
import { TUTORIAL_STORAGE_KEY, loadTutorialState } from '../state/tutorialState';
import { makeCase, makeProgress } from '../test/fixtures';
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

const caseData = makeCase();

describe('hintFor', () => {
  it('調査段階: 未閲覧 → 閲覧 1 件 → 照合未選択 → 計算未入力 → 記事へ', () => {
    expect(hintFor(caseData, makeProgress(), 'investigate')).toBe('open');
    expect(hintFor(caseData, makeProgress({ opened: ['free'] }), 'investigate')).toBe('openMore');
    const read2 = makeProgress({ opened: ['a', 'b'] });
    expect(hintFor(caseData, read2, 'investigate')).toBe('link');
    expect(hintFor(caseData, { ...read2, chosenLink: ['a'] }, 'investigate')).toBe('link');
    const linked = { ...read2, chosenLink: ['a', 'b'] };
    expect(hintFor(caseData, linked, 'investigate')).toBe('calculate');
    expect(hintFor(caseData, { ...linked, calculations: { t1: '1' } }, 'investigate')).toBe(
      'calculate',
    );
    expect(
      hintFor(caseData, { ...linked, calculations: { t1: '1', t2: ' 2 ' } }, 'investigate'),
    ).toBe('toArticle');
  });

  it('記事段階: 断片 3 未満 → 断片、3 そろえば提出。提出済みは null', () => {
    expect(hintFor(caseData, makeProgress(), 'article')).toBe('fragments');
    expect(hintFor(caseData, makeProgress({ article: ['f0', 'f1'] }), 'article')).toBe('fragments');
    expect(hintFor(caseData, makeProgress({ article: ['f0', 'f1', 'f2'] }), 'article')).toBe(
      'submit',
    );
    expect(hintFor(caseData, makeProgress({ published: true }), 'article')).toBeNull();
    expect(hintFor(caseData, makeProgress({ published: true }), 'investigate')).toBeNull();
  });

  it('ヒント文に正解の資料名・断片・数値を含まない', () => {
    const texts = Object.values(UI.tutorial.hint).join('\n');
    for (const doc of caseData.documents) expect(texts).not.toContain(doc.title);
    for (const f of caseData.headline_fragments) expect(texts).not.toContain(f.text);
    expect(texts).not.toMatch(/45|200/);
  });
});

describe('TutorialHint', () => {
  it('状態に応じて文言が切り替わり、role=status で出る', () => {
    const storage = memoryStorage();
    const { rerender } = render(
      <TutorialHint
        caseData={caseData}
        progress={makeProgress()}
        stage="investigate"
        storage={storage}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(UI.tutorial.hint.open);
    rerender(
      <TutorialHint
        caseData={caseData}
        progress={makeProgress({ opened: ['free'] })}
        stage="investigate"
        storage={storage}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(UI.tutorial.hint.openMore);
    rerender(
      <TutorialHint
        caseData={caseData}
        progress={makeProgress()}
        stage="article"
        storage={storage}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(UI.tutorial.hint.fragments);
    rerender(
      <TutorialHint
        caseData={caseData}
        progress={makeProgress({ published: true })}
        stage="article"
        storage={storage}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('「ヒントを閉じる」で消え、保存される（再描画でも出ない）', async () => {
    const storage = memoryStorage();
    const user = userEvent.setup();
    const { unmount } = render(
      <TutorialHint
        caseData={caseData}
        progress={makeProgress()}
        stage="investigate"
        storage={storage}
      />,
    );
    await user.click(screen.getByRole('button', { name: UI.tutorial.hint.dismiss }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(loadTutorialState(storage).hintsEnabled).toBe(false);
    unmount();
    render(
      <TutorialHint
        caseData={caseData}
        progress={makeProgress()}
        stage="investigate"
        storage={storage}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('保存済みで hintsEnabled=false なら最初から出ない', () => {
    const storage = memoryStorage();
    storage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ completed: true, hintsEnabled: false }));
    render(
      <TutorialHint
        caseData={caseData}
        progress={makeProgress()}
        stage="investigate"
        storage={storage}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
