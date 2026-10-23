/**
 * public/assets 配下の URL を配信ベースパス付きで返す。
 *
 * `import.meta.env.BASE_URL` は vite.config.ts の `base` に従い、
 * 開発・プレビューでは `/`、GitHub Pages 本番では `/URAMEKU/` になる。
 * 末尾スラッシュの有無や空文字でも二重スラッシュにならないよう正規化する。
 */
export function assetUrl(relativePath: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${base}/assets/${relativePath.replace(/^\/+/, '')}`;
}

export function documentThumbnail(caseId: string, documentId: string): string {
  return assetUrl(`cases/${caseId}/documents/${documentId}.png`);
}
