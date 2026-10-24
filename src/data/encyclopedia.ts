import achievementsJson from '../../data/achievements.json';
import encyclopediaJa from '../../data/encyclopedia/ja.json';

/**
 * 図鑑（data/encyclopedia/ja.json）と実績（data/achievements.json）の読込と型。
 *
 * - 文言は JSON をそのまま使い、ここでは加工しない（人格・能力評価を含まないことは
 *   `npm run lint:content` と人手レビューで担保する）。
 * - `art` / `icon` が `public/` に実在するかの検査は MVP-033 の責務。ここでは
 *   「相対パス形式（先頭に `/` や `..` を含まない）」だけを型と検証で保証する。
 * - 解放・実績の判定ロジックは `src/domain/unlocks.ts`。
 */

export interface EncyclopediaEntry {
  id: string;
  title: string;
  summary: string;
  /** この項目を解放する事件 ID（data/cases の `id` と一致すること） */
  unlockCase: string;
  /** `public/` からの相対パス */
  art: string;
  disclaimer: string;
}

export interface Achievement {
  id: string;
  title: string;
  /** プレイヤー向けの達成条件の説明文。判定ロジックは unlocks.ts が持つ */
  rule: string;
  /** `public/` からの相対パス */
  icon: string;
}

/** `public/` からの相対パスとして妥当な形式か（存在確認はしない） */
export function isRelativeAssetPath(path: string): boolean {
  if (path.trim() === '' || path !== path.trim()) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;
  if (/^[a-z]+:/i.test(path)) return false; // URL スキーム
  if (path.split(/[\\/]/).some((seg) => seg === '..' || seg === '')) return false;
  return true;
}

function requireString(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`${where}: "${key}" は空でない文字列である必要があります`);
  }
  return v;
}

function requireAssetPath(obj: Record<string, unknown>, key: string, where: string): string {
  const v = requireString(obj, key, where);
  if (!isRelativeAssetPath(v)) {
    throw new Error(`${where}: "${key}" は public/ からの相対パスである必要があります: ${v}`);
  }
  return v;
}

function assertRecord(raw: unknown, where: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${where}: オブジェクトではありません`);
  }
  return raw as Record<string, unknown>;
}

function assertUniqueIds(items: { id: string }[], where: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`${where}: id が重複しています: ${item.id}`);
    seen.add(item.id);
  }
}

/** 図鑑項目の配列として検証する。不正なら例外（起動時に気づけるようにする） */
export function assertEncyclopedia(raw: unknown, where = 'data/encyclopedia'): EncyclopediaEntry[] {
  if (!Array.isArray(raw)) throw new Error(`${where}: 配列ではありません`);
  const entries = raw.map((item, i) => {
    const r = assertRecord(item, `${where}[${i}]`);
    const at = `${where}[${i}]`;
    return {
      id: requireString(r, 'id', at),
      title: requireString(r, 'title', at),
      summary: requireString(r, 'summary', at),
      unlockCase: requireString(r, 'unlockCase', at),
      art: requireAssetPath(r, 'art', at),
      disclaimer: requireString(r, 'disclaimer', at),
    };
  });
  assertUniqueIds(entries, where);
  return entries;
}

/** 実績の配列として検証する。不正なら例外 */
export function assertAchievements(raw: unknown, where = 'data/achievements'): Achievement[] {
  if (!Array.isArray(raw)) throw new Error(`${where}: 配列ではありません`);
  const items = raw.map((item, i) => {
    const r = assertRecord(item, `${where}[${i}]`);
    const at = `${where}[${i}]`;
    return {
      id: requireString(r, 'id', at),
      title: requireString(r, 'title', at),
      rule: requireString(r, 'rule', at),
      icon: requireAssetPath(r, 'icon', at),
    };
  });
  assertUniqueIds(items, where);
  return items;
}

export const ENCYCLOPEDIA: EncyclopediaEntry[] = assertEncyclopedia(
  encyclopediaJa,
  'data/encyclopedia/ja.json',
);

export const ACHIEVEMENTS: Achievement[] = assertAchievements(
  achievementsJson,
  'data/achievements.json',
);

export function findEntry(id: string): EncyclopediaEntry | undefined {
  return ENCYCLOPEDIA.find((e) => e.id === id);
}

export function findAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
