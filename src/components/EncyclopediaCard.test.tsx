import { render, screen } from '@testing-library/react';
import { EncyclopediaCard, entryArtUrl } from './EncyclopediaCard';
import type { EncyclopediaEntry } from '../data/encyclopedia';

const entry: EncyclopediaEntry = {
  id: 'framing',
  title: '題名X',
  summary: '要約Y',
  unlockCase: 'case-01',
  art: 'assets/encyclopedia/framing.png',
  disclaimer: '注記Z',
};

describe('EncyclopediaCard', () => {
  it('未解放は鍵の絵と解放条件だけ。題名・要約・注記は出さない', () => {
    render(
      <ul>
        <EncyclopediaCard entry={entry} unlocked={false} caseNumber={1} />
      </ul>,
    );
    expect(screen.getByText('CASE 01 を解決すると追加')).toBeInTheDocument();
    expect(screen.queryByText('題名X')).not.toBeInTheDocument();
    expect(screen.queryByText('要約Y')).not.toBeInTheDocument();
    expect(screen.queryByText('注記Z')).not.toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/ui/illustrations/locked.svg',
    );
  });

  it('解放済みは題名・要約・注記を出す', () => {
    render(
      <ul>
        <EncyclopediaCard entry={entry} unlocked caseNumber={1} />
      </ul>,
    );
    expect(screen.getByRole('heading', { name: '題名X' })).toBeInTheDocument();
    expect(screen.getByText('要約Y')).toBeInTheDocument();
    expect(screen.getByText('注記Z')).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/encyclopedia/framing.png',
    );
  });

  it('事件番号が不明なら汎用文言', () => {
    render(
      <ul>
        <EncyclopediaCard entry={entry} unlocked={false} caseNumber={null} />
      </ul>,
    );
    expect(screen.getByText('事件を解決すると追加')).toBeInTheDocument();
  });

  it('entryArtUrl: 未収録 ID は JSON の art を使う', () => {
    expect(entryArtUrl({ id: 'unknown', art: 'encyclopedia/x.png' })).toBe(
      '/assets/encyclopedia/x.png',
    );
  });
});
