/**
 * public/assets 配下の URL を配信ベースパス付きで返す。
 *
 * `import.meta.env.BASE_URL` は vite.config.ts の `base` に従い、
 * 開発・プレビューでは `/`、GitHub Pages 本番では `/URAMEKU/` になる。
 * 末尾スラッシュの有無や空文字でも二重スラッシュにならないよう正規化する。
 *
 * 用途別ヘルパー（`backgroundUrl` など）は `public/assets` の実ディレクトリ構成に
 * 合わせており、受け付ける名前は `as const` 配列で列挙している。
 * 「無いものを有ることにしない」方針により、収録されていない組み合わせ
 * （例: メガの `point` ポーズ）は型で禁止し、実行時にも例外にする。
 * 各ヘルパーの返すパスが `assets.manifest.json` に存在することは `assets.test.ts` で検証する。
 */
export function assetUrl(relativePath: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${base}/assets/${relativePath.replace(/^\/+/, '')}`;
}

/** 同じ絵を SVG と PNG の両方で収録しているカテゴリの形式指定。 */
export type ImageFormat = 'svg' | 'png';

// ---------------------------------------------------------------------------
// 事件（cases/<caseId>/...）
// ---------------------------------------------------------------------------

export function documentThumbnail(caseId: string, documentId: string): string {
  return assetUrl(`cases/${caseId}/documents/${documentId}.png`);
}

/** Default to the lightweight illustration; explicit formats retain source/legacy access. */
export function caseCover(caseId: string, format?: ImageFormat): string {
  return assetUrl(`cases/${caseId}/cover.${format ?? 'webp'}`);
}

// ---------------------------------------------------------------------------
// キャラクター（characters/<id>/{reactions,poses,icons}）
// ---------------------------------------------------------------------------

export const CHARACTER_IDS = ['shinobu', 'mega', 'kuro', 'harada'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export const REACTIONS = ['idle', 'happy', 'surprised', 'thinking', 'worried'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const ICON_SIZES = [64, 128, 256, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/** 収録済みのポーズ。シノブ以外は `idle` のみ（追加作画はしない）。 */
export const CHARACTER_POSES = {
  shinobu: ['idle', 'point', 'inspect', 'explain'],
  mega: ['idle'],
  kuro: ['idle'],
  harada: ['idle'],
} as const satisfies Record<CharacterId, readonly string[]>;
export type CharacterPose<C extends CharacterId = CharacterId> =
  (typeof CHARACTER_POSES)[C][number];

/** 固定原画＋記号を合成したリアクション立ち絵。 */
export function characterReaction(id: CharacterId, reaction: Reaction = 'idle'): string {
  return assetUrl(`characters/${id}/reactions/${reaction}.png`);
}

/** 原画ポーズ。収録されていない組み合わせは型エラー（実行時は例外）。 */
export function characterPose<C extends CharacterId>(
  id: C,
  pose: CharacterPose<C> = 'idle' as CharacterPose<C>,
): string {
  const allowed: readonly string[] = CHARACTER_POSES[id];
  if (!allowed.includes(pose)) {
    throw new Error(`Pose unavailable for ${id}: ${pose} (available: ${allowed.join(', ')})`);
  }
  return assetUrl(`characters/${id}/poses/${pose}.png`);
}

export function characterIcon(
  id: CharacterId,
  reaction: Reaction = 'idle',
  size: IconSize = 256,
): string {
  return assetUrl(`characters/${id}/icons/${reaction}-${size}.png`);
}

// ---------------------------------------------------------------------------
// 背景・テクスチャ
// ---------------------------------------------------------------------------

export const BACKGROUND_NAMES = [
  'desk',
  'newsprint',
  'redaction',
  'scene-archive',
  'scene-caseboard',
  'scene-library',
  'scene-menu',
  'scene-newspaper',
  'scene-office',
  'scene-result',
] as const;
export type BackgroundName = (typeof BACKGROUND_NAMES)[number];

export function backgroundUrl(name: BackgroundName, format: ImageFormat = 'svg'): string {
  return assetUrl(`backgrounds/${name}.${format}`);
}

/**
 * C-2 高解像度素材（`public/assets/c2-highres`）。タイトル背景は採用済みの A 案のみ収録し、
 * ほかの候補（B/C/D）は混在させない。いずれも低解像度原画のアップスケールで、正式アート承認前。
 */
export const C2_HIGHRES = {
  title: 'title-a.webp',
  header: 'header-band.webp',
  /** 縦長ページ用（左右の端だけコラージュ、縦に繰り返す） */
  paperTile: 'paper-side-tile.webp',
  /** 画面サイズの面用（四辺がコラージュ、中央が無地）。資料ダイアログの背面 */
  paperFrame: 'paper-frame.webp',
  board: 'cork-board.webp',
  clippingCorner: 'clipping-corner.webp',
  clippingVertical: 'clipping-vertical.webp',
  clippingHorizontal: 'clipping-horizontal.webp',
} as const;
export type C2HighresName = keyof typeof C2_HIGHRES;

export function c2HighresUrl(name: C2HighresName): string {
  return assetUrl(`c2-highres/${C2_HIGHRES[name]}`);
}

export const TEXTURE_NAMES = [
  'blueprint',
  'halftone',
  'kraft',
  'newsprint',
  'paper',
  'redprint',
] as const;
export type TextureName = (typeof TEXTURE_NAMES)[number];

export function textureUrl(name: TextureName, format: ImageFormat = 'svg'): string {
  return assetUrl(`textures/${name}.${format}`);
}

// ---------------------------------------------------------------------------
// 図鑑・実績・チュートリアル
// ---------------------------------------------------------------------------

export const ENCYCLOPEDIA_IDS = [
  'anchoring',
  'framing',
  'graph-scale',
  'social-proof',
  'sunk-cost',
] as const;
export type EncyclopediaId = (typeof ENCYCLOPEDIA_IDS)[number];

export function encyclopediaArt(id: EncyclopediaId, format: ImageFormat = 'png'): string {
  return assetUrl(`encyclopedia/${id}.${format}`);
}

export const ACHIEVEMENT_IDS = [
  'first-evidence',
  'first-link',
  'five-cases',
  'no-hint',
  'number-check',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export function achievementIcon(id: AchievementId, format: ImageFormat = 'png'): string {
  return assetUrl(`achievements/${id}.${format}`);
}

export const TUTORIAL_STEPS = [1, 2, 3, 4, 5, 6] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export function tutorialStep(step: TutorialStep, format: ImageFormat = 'png'): string {
  return assetUrl(`tutorial/step-${String(step).padStart(2, '0')}.${format}`);
}

// ---------------------------------------------------------------------------
// UI 部品（ui/<kind>/<name>）
// ---------------------------------------------------------------------------

export const UI_STAMP_NAMES = [
  'accepted',
  'confidential',
  'draft',
  'perfect',
  'rejected',
  'verified',
] as const;
export type UiStampName = (typeof UI_STAMP_NAMES)[number];

export function uiStamp(name: UiStampName, format: ImageFormat = 'svg'): string {
  return assetUrl(`ui/stamps/${name}.${format}`);
}

export const UI_STATE_NAMES = [
  'clear',
  'draft',
  'invalid',
  'investigate',
  'locked',
  'new',
  'published',
  'solved',
  'unseen',
  'verified',
] as const;
export type UiStateName = (typeof UI_STATE_NAMES)[number];

export function uiState(name: UiStateName, format: ImageFormat = 'svg'): string {
  return assetUrl(`ui/states/${name}.${format}`);
}

export const UI_FRAME_NAMES = [
  'caption',
  'case-card',
  'clipping',
  'dialogue',
  'evidence-pin',
  'newspaper',
  'photo-frame',
  'result-panel',
  'stamp',
  'sticky-note',
  'tab',
  'torn-paper',
] as const;
export type UiFrameName = (typeof UI_FRAME_NAMES)[number];

export function uiFrame(name: UiFrameName, format: ImageFormat = 'svg'): string {
  return assetUrl(`ui/frames/${name}.${format}`);
}

export const UI_GRADES = ['s', 'a', 'b', 'c', 'd'] as const;
export type UiGrade = (typeof UI_GRADES)[number];

export function uiGrade(grade: UiGrade, format: ImageFormat = 'svg'): string {
  return assetUrl(`ui/grades/grade-${grade}.${format}`);
}

export const UI_ILLUSTRATION_NAMES = ['complete', 'empty', 'error', 'locked', 'offline'] as const;
export type UiIllustrationName = (typeof UI_ILLUSTRATION_NAMES)[number];

export function uiIllustration(name: UiIllustrationName, format: ImageFormat = 'svg'): string {
  return assetUrl(`ui/illustrations/${name}.${format}`);
}

export const UI_ICON_NAMES = [
  'achievement',
  'arrow-left',
  'arrow-right',
  'board',
  'book',
  'budget',
  'calculate',
  'case',
  'chart',
  'check',
  'clipboard',
  'close',
  'document',
  'download',
  'edit',
  'filter',
  'hint',
  'home',
  'inspect',
  'link',
  'lock',
  'menu',
  'mute',
  'notes',
  'offline',
  'pause',
  'pin',
  'play',
  'quote',
  'read',
  'reset',
  'save',
  'settings',
  'share',
  'sound',
  'stamp',
  'time',
  'trash',
  'unlock',
  'warning',
] as const;
export type UiIconName = (typeof UI_ICON_NAMES)[number];

export function uiIcon(name: UiIconName, format: ImageFormat = 'svg'): string {
  return assetUrl(`ui/icons/${name}.${format}`);
}

export const UI_TAPE_COUNT = 12;

export function uiTape(index: number, format: ImageFormat = 'svg'): string {
  if (!Number.isInteger(index) || index < 1 || index > UI_TAPE_COUNT) {
    throw new Error(`Tape unavailable: ${index} (1..${UI_TAPE_COUNT})`);
  }
  return assetUrl(`ui/tapes/tape-${String(index).padStart(2, '0')}.${format}`);
}

// ---------------------------------------------------------------------------
// 小物・演出
// ---------------------------------------------------------------------------

export const PROP_NAMES = [
  'advert',
  'clipping',
  'label',
  'ledger',
  'news',
  'photo',
  'receipt',
  'report',
  'ticket',
] as const;
export type PropName = (typeof PROP_NAMES)[number];

export function propUrl(name: PropName, format: ImageFormat = 'svg'): string {
  return assetUrl(`props/${name}.${format}`);
}

export const EFFECT_REACTION_NAMES = [
  'conflict',
  'discovery',
  'focus',
  'idea',
  'question',
  'surprise',
] as const;
export type EffectReactionName = (typeof EFFECT_REACTION_NAMES)[number];

export function effectReaction(name: EffectReactionName, format: ImageFormat = 'svg'): string {
  return assetUrl(`effects/reactions/${name}.${format}`);
}
