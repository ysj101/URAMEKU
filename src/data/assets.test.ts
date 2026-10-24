import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACHIEVEMENT_IDS,
  BACKGROUND_NAMES,
  CHARACTER_IDS,
  CHARACTER_POSES,
  EFFECT_REACTION_NAMES,
  ENCYCLOPEDIA_IDS,
  ICON_SIZES,
  PROP_NAMES,
  REACTIONS,
  TEXTURE_NAMES,
  TUTORIAL_STEPS,
  UI_FRAME_NAMES,
  UI_GRADES,
  UI_ICON_NAMES,
  UI_ILLUSTRATION_NAMES,
  UI_STAMP_NAMES,
  UI_STATE_NAMES,
  UI_TAPE_COUNT,
  achievementIcon,
  assetUrl,
  backgroundUrl,
  C2_HIGHRES,
  c2HighresUrl,
  type C2HighresName,
  caseCover,
  characterIcon,
  characterPose,
  characterReaction,
  documentThumbnail,
  effectReaction,
  encyclopediaArt,
  propUrl,
  textureUrl,
  tutorialStep,
  uiFrame,
  uiGrade,
  uiIcon,
  uiIllustration,
  uiStamp,
  uiState,
  uiTape,
} from './assets';
import { MANIFEST_FILE, isKnownAsset, manifestPaths, normalizeAssetPath } from './assetManifest';
import { CASES } from './cases';

describe('assetUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ルート配信（base = "/"）では /assets/... を返す', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(assetUrl('characters/shinobu/poses/idle.png')).toBe(
      '/assets/characters/shinobu/poses/idle.png',
    );
  });

  it('サブパス配信（base = "/URAMEKU/"）では /URAMEKU/assets/... を返す', () => {
    vi.stubEnv('BASE_URL', '/URAMEKU/');
    expect(assetUrl('characters/shinobu/poses/idle.png')).toBe(
      '/URAMEKU/assets/characters/shinobu/poses/idle.png',
    );
  });

  it('末尾スラッシュ無しの base でも二重スラッシュにならない', () => {
    vi.stubEnv('BASE_URL', '/URAMEKU');
    expect(assetUrl('cases/case-01/documents/ad.png')).toBe(
      '/URAMEKU/assets/cases/case-01/documents/ad.png',
    );
  });

  it('空文字の base はルート扱い', () => {
    vi.stubEnv('BASE_URL', '');
    expect(assetUrl('brand/favicon-32.png')).toBe('/assets/brand/favicon-32.png');
  });

  it('relativePath の先頭スラッシュは取り除く', () => {
    vi.stubEnv('BASE_URL', '/URAMEKU/');
    expect(assetUrl('/ui/icon.svg')).toBe('/URAMEKU/assets/ui/icon.svg');
  });
});

describe('documentThumbnail', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('cases/<caseId>/documents/<documentId>.png を base 付きで返す', () => {
    vi.stubEnv('BASE_URL', '/URAMEKU/');
    expect(documentThumbnail('case-01', 'ad')).toBe(
      '/URAMEKU/assets/cases/case-01/documents/ad.png',
    );
  });
});

// ---------------------------------------------------------------------------
// 用途別ヘルパー: 返すパスがマニフェストに載っていて、public/ 配下に実在すること
// ---------------------------------------------------------------------------

const PUBLIC_ASSETS = resolve(MANIFEST_FILE, '..', 'public', 'assets');

/** URL がマニフェストに載っていてファイルも実在すれば true。失敗時は URL を返す（メッセージ用）。 */
function verify(url: string): string | null {
  const rel = normalizeAssetPath(url);
  const ok = isKnownAsset(rel) && existsSync(resolve(PUBLIC_ASSETS, rel));
  return ok ? null : url;
}

function verifyAll(urls: string[]): void {
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.map(verify).filter((u) => u !== null)).toEqual([]);
}

/** マニフェスト上で `<dir>/<name>.<ext>` に一致する name の集合。 */
function manifestNames(dir: string, ext: string): string[] {
  const re = new RegExp(`^${dir}/([^/]+)\\.${ext}$`);
  return [...manifestPaths()]
    .map((p) => re.exec(p)?.[1])
    .filter((n): n is string => n !== undefined)
    .sort();
}

describe('用途別ヘルパー（マニフェスト照合）', () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/URAMEKU/');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('5 事件 × 6 資料のサムネイルとカバー', () => {
    const cases = CASES;
    expect(cases).toHaveLength(5);
    const urls: string[] = [];
    for (const c of cases) {
      expect(c.documents).toHaveLength(6);
      urls.push(caseCover(c.id), caseCover(c.id, 'svg'));
      for (const d of c.documents) urls.push(documentThumbnail(c.id, d.id));
    }
    expect(urls).toHaveLength(5 * 2 + 30);
    verifyAll(urls);
  });

  it('キャラ 4 人 × 5 リアクション（立ち絵・アイコン 4 サイズ）', () => {
    const urls: string[] = [];
    for (const id of CHARACTER_IDS) {
      for (const r of REACTIONS) {
        urls.push(characterReaction(id, r));
        for (const size of ICON_SIZES) urls.push(characterIcon(id, r, size));
      }
    }
    expect(urls).toHaveLength(4 * 5 * (1 + 4));
    verifyAll(urls);
    expect(characterReaction('shinobu')).toBe(
      '/URAMEKU/assets/characters/shinobu/reactions/idle.png',
    );
    expect(characterIcon('kuro')).toBe('/URAMEKU/assets/characters/kuro/icons/idle-256.png');
  });

  it('収録済みポーズ（シノブ 4 種、他 3 人は idle のみ）', () => {
    const urls: string[] = [];
    for (const id of CHARACTER_IDS) {
      for (const pose of CHARACTER_POSES[id]) urls.push(characterPose(id, pose));
      urls.push(characterPose(id));
    }
    verifyAll(urls);
    // マニフェストの poses/ と CHARACTER_POSES が一致する（無いものを有ることにしない）
    for (const id of CHARACTER_IDS) {
      expect(manifestNames(`characters/${id}/poses`, 'png')).toEqual(
        [...CHARACTER_POSES[id]].sort(),
      );
    }
  });

  it('収録されていないポーズは型で禁止し、実行時にも例外', () => {
    // @ts-expect-error メガには point ポーズが無い
    expect(() => characterPose('mega', 'point')).toThrow(/Pose unavailable for mega: point/);
    expect(() => characterPose('harada', 'inspect' as never)).toThrow(/Pose unavailable/);
    expect(() => characterPose('shinobu', 'point')).not.toThrow();
  });

  it('図鑑 5 件（png / svg）', () => {
    verifyAll(ENCYCLOPEDIA_IDS.flatMap((id) => [encyclopediaArt(id), encyclopediaArt(id, 'svg')]));
    expect(manifestNames('encyclopedia', 'png')).toEqual([...ENCYCLOPEDIA_IDS].sort());
    expect(encyclopediaArt('graph-scale')).toBe('/URAMEKU/assets/encyclopedia/graph-scale.png');
  });

  it('実績 5 件（png / svg）', () => {
    verifyAll(ACHIEVEMENT_IDS.flatMap((id) => [achievementIcon(id), achievementIcon(id, 'svg')]));
    expect(manifestNames('achievements', 'png')).toEqual([...ACHIEVEMENT_IDS].sort());
    expect(achievementIcon('no-hint')).toBe('/URAMEKU/assets/achievements/no-hint.png');
  });

  it('背景 10 種・テクスチャ 6 種（svg / png）', () => {
    verifyAll(BACKGROUND_NAMES.flatMap((n) => [backgroundUrl(n), backgroundUrl(n, 'png')]));
    verifyAll(TEXTURE_NAMES.flatMap((n) => [textureUrl(n), textureUrl(n, 'png')]));
    expect(manifestNames('backgrounds', 'svg')).toEqual([...BACKGROUND_NAMES].sort());
    expect(manifestNames('textures', 'svg')).toEqual([...TEXTURE_NAMES].sort());
    expect(backgroundUrl('scene-office')).toBe('/URAMEKU/assets/backgrounds/scene-office.svg');
    expect(textureUrl('kraft', 'png')).toBe('/URAMEKU/assets/textures/kraft.png');
  });

  it('C-2 高解像度素材（A 案のみ・マニフェストと一致）', () => {
    const names = Object.keys(C2_HIGHRES) as C2HighresName[];
    verifyAll(names.map((n) => c2HighresUrl(n)));
    // 収録ファイルとヘルパーの列挙が一致する（比較用の B/C/D 案を混在させない）
    const listed = [...manifestPaths()].filter((p) => p.startsWith('c2-highres/')).sort();
    expect(listed).toEqual(names.map((n) => `c2-highres/${C2_HIGHRES[n]}`).sort());
    expect(c2HighresUrl('title')).toBe('/URAMEKU/assets/c2-highres/title-a.webp');
  });

  it('UI 部品（スタンプ・状態・フレーム・グレード・イラスト・アイコン・テープ）', () => {
    verifyAll(UI_STAMP_NAMES.flatMap((n) => [uiStamp(n), uiStamp(n, 'png')]));
    verifyAll(UI_STATE_NAMES.flatMap((n) => [uiState(n), uiState(n, 'png')]));
    verifyAll(UI_FRAME_NAMES.flatMap((n) => [uiFrame(n), uiFrame(n, 'png')]));
    verifyAll(UI_GRADES.flatMap((g) => [uiGrade(g), uiGrade(g, 'png')]));
    verifyAll(UI_ILLUSTRATION_NAMES.flatMap((n) => [uiIllustration(n), uiIllustration(n, 'png')]));
    verifyAll(UI_ICON_NAMES.flatMap((n) => [uiIcon(n), uiIcon(n, 'png')]));
    const tapes = Array.from({ length: UI_TAPE_COUNT }, (_, i) => i + 1);
    verifyAll(tapes.flatMap((i) => [uiTape(i), uiTape(i, 'png')]));

    expect(manifestNames('ui/stamps', 'svg')).toEqual([...UI_STAMP_NAMES].sort());
    expect(manifestNames('ui/states', 'svg')).toEqual([...UI_STATE_NAMES].sort());
    expect(manifestNames('ui/frames', 'svg')).toEqual([...UI_FRAME_NAMES].sort());
    expect(manifestNames('ui/icons', 'svg')).toEqual([...UI_ICON_NAMES].sort());
    expect(manifestNames('ui/illustrations', 'svg')).toEqual([...UI_ILLUSTRATION_NAMES].sort());
    expect(manifestNames('ui/grades', 'svg')).toEqual(UI_GRADES.map((g) => `grade-${g}`).sort());
    expect(manifestNames('ui/tapes', 'svg')).toHaveLength(UI_TAPE_COUNT);

    expect(uiStamp('confidential')).toBe('/URAMEKU/assets/ui/stamps/confidential.svg');
    expect(uiGrade('s')).toBe('/URAMEKU/assets/ui/grades/grade-s.svg');
    expect(uiTape(3)).toBe('/URAMEKU/assets/ui/tapes/tape-03.svg');
    expect(() => uiTape(0)).toThrow(/Tape unavailable/);
    expect(() => uiTape(13)).toThrow(/Tape unavailable/);
  });

  it('小物・演出・チュートリアル', () => {
    verifyAll(PROP_NAMES.flatMap((n) => [propUrl(n), propUrl(n, 'png')]));
    verifyAll(EFFECT_REACTION_NAMES.flatMap((n) => [effectReaction(n), effectReaction(n, 'png')]));
    verifyAll(TUTORIAL_STEPS.flatMap((s) => [tutorialStep(s), tutorialStep(s, 'svg')]));
    expect(manifestNames('props', 'svg')).toEqual([...PROP_NAMES].sort());
    expect(manifestNames('effects/reactions', 'svg')).toEqual([...EFFECT_REACTION_NAMES].sort());
    expect(tutorialStep(1)).toBe('/URAMEKU/assets/tutorial/step-01.png');
  });
});
