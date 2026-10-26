import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Navigation } from '../app/navigation';
import { CaseNotebook } from '../components/CaseNotebook';
import { EncyclopediaCard } from '../components/EncyclopediaCard';
import {
  ACHIEVEMENT_IDS as ACHIEVEMENT_ICON_IDS,
  achievementIcon,
  type AchievementId as AchievementIconId,
} from '../data/assets';
import { ACHIEVEMENTS, ENCYCLOPEDIA } from '../data/encyclopedia';
import { UI } from '../data/ui';
import { evaluateAchievements, isEntryUnlocked } from '../domain/unlocks';
import type { GameApi } from '../state/useGame';
import '../app/screens/encyclopedia.css';

type TabId = 'entries' | 'notebook' | 'achievements';

const TABS: { id: TabId; label: string }[] = [
  { id: 'entries', label: UI.home.encyclopedia },
  { id: 'notebook', label: '事件手帳' },
  { id: 'achievements', label: '実績' },
];

/** 実績は保存していないため、画面表示のたびに現在の進行から判定する（純粋関数） */
function earnedAchievementIds(game: GameApi): Set<string> {
  const { earned } = evaluateAchievements({
    cases: game.cases,
    progress: game.progressByCase ?? {},
    finished: game.finished,
  });
  return new Set(Object.keys(earned));
}

function iconFor(id: string): string | null {
  return (ACHIEVEMENT_ICON_IDS as readonly string[]).includes(id)
    ? achievementIcon(id as AchievementIconId)
    : null;
}

/**
 * 図鑑画面。図鑑 / 事件手帳 / 実績 の 3 タブ。
 * - 図鑑は合格済みの事件に対応する項目だけ本文を出す（未解放は概念名も出さない）
 * - 事件手帳は事実（状態・予算）のみ。個人を分類・評価する表現は置かない
 */
export function EncyclopediaScreen({ game, nav }: { game: GameApi; nav: Navigation }) {
  const [tab, setTab] = useState<TabId>('entries');
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  };

  const unlockedCount = ENCYCLOPEDIA.filter((e) => isEntryUnlocked(e, game.finished)).length;
  const earned = earnedAchievementIds(game);

  return (
    <section className="encyclopedia" aria-labelledby="encyclopedia-title">
      <div className="screen-head">
        <button
          type="button"
          className="btn ghost"
          onClick={() => nav.navigate({ screen: 'home' })}
        >
          ← ホーム
        </button>
        <h1 id="encyclopedia-title">{UI.home.encyclopedia}</h1>
      </div>

      <div className="encyclopedia-tabs" role="tablist" aria-label="図鑑の分類">
        {TABS.map((t, i) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={`encyclopedia-tab${selected ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {TABS.map((t) => {
        const selected = tab === t.id;
        return (
          <div
            key={t.id}
            role="tabpanel"
            id={`${baseId}-panel-${t.id}`}
            aria-labelledby={`${baseId}-tab-${t.id}`}
            hidden={!selected}
            tabIndex={0}
            className="encyclopedia-panel"
          >
            {selected && t.id === 'entries' && (
              <>
                <p className="encyclopedia-count">
                  解放済み {unlockedCount} / {ENCYCLOPEDIA.length}
                </p>
                <ul className="encyclopedia-list">
                  {ENCYCLOPEDIA.map((entry) => {
                    const idx = game.cases.findIndex((c) => c.id === entry.unlockCase);
                    return (
                      <EncyclopediaCard
                        key={entry.id}
                        entry={entry}
                        unlocked={isEntryUnlocked(entry, game.finished)}
                        caseNumber={idx >= 0 ? idx + 1 : null}
                      />
                    );
                  })}
                </ul>
              </>
            )}
            {selected && t.id === 'notebook' && (
              <CaseNotebook
                cases={game.cases}
                progressByCase={game.progressByCase ?? {}}
                finished={game.finished}
              />
            )}
            {selected && t.id === 'achievements' && (
              <ul className="achievement-list">
                {ACHIEVEMENTS.filter(
                  (a) => a.id !== 'number-check' || game.cases.some((c) => !c.v2),
                ).map((a) => {
                  const got = earned.has(a.id);
                  const icon = iconFor(a.id);
                  return (
                    <li
                      key={a.id}
                      className={`achievement-row${got ? ' earned' : ''}`}
                      data-achievement-state={got ? 'earned' : 'locked'}
                    >
                      {icon && <img className="achievement-icon" src={icon} alt="" />}
                      <div className="achievement-body">
                        <span className="achievement-title">{a.title}</span>
                        <span className="achievement-rule">{a.rule}</span>
                      </div>
                      <span className={`achievement-state${got ? ' earned' : ''}`}>
                        {got ? '取得' : '未取得'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <p className="fine">{UI.notices.notDiagnosis}</p>
    </section>
  );
}
