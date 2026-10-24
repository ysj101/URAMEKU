import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetUrl, documentThumbnail } from './assets';

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
