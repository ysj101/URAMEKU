/** public/assets 配下の URL を配信ベースパス付きで返す */
export function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/assets/${relativePath.replace(/^\//, '')}`;
}

export function documentThumbnail(caseId: string, documentId: string): string {
  return assetUrl(`cases/${caseId}/documents/${documentId}.png`);
}
