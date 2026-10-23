import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MANIFEST_FILE,
  MANIFEST_PREFIX,
  isKnownAsset,
  loadManifest,
  manifestPaths,
  normalizeAssetPath,
} from './assetManifest';

const ROOT = resolve(MANIFEST_FILE, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('assetManifest', () => {
  it('assets.manifest.json を読み込み、asset_count と件数が一致する', () => {
    const manifest = loadManifest();
    expect(manifest.product).toBe('ウラメク');
    expect(manifest.assets.length).toBe(manifest.asset_count);
    expect(manifest.assets.every((a) => a.path.startsWith(MANIFEST_PREFIX))).toBe(true);
  });

  it('manifestPaths() は public/assets からの相対パス集合を返す', () => {
    const paths = manifestPaths();
    expect(paths.size).toBe(loadManifest().asset_count);
    expect(paths.has('brand/favicon-32.png')).toBe(true);
    expect(paths.has('public/assets/brand/favicon-32.png')).toBe(false);
  });

  it('マニフェストの全パスが public/ 配下に実在する', () => {
    const missing = loadManifest().assets.filter((a) => !existsSync(resolve(ROOT, a.path)));
    expect(missing.map((a) => a.path)).toEqual([]);
  });

  it('public/assets 配下の全ファイルがマニフェストに載っている（正本との乖離なし）', () => {
    const files = walk(resolve(ROOT, 'public/assets'))
      .map((f) => relative(resolve(ROOT, 'public/assets'), f))
      // OS が作る隠しファイル（.DS_Store 等）は git 管理外なので対象にしない
      .filter((f) => !f.split('/').some((seg) => seg.startsWith('.')));
    const unknown = files.filter((f) => !isKnownAsset(f));
    expect(unknown).toEqual([]);
  });

  it('normalizeAssetPath はどの表記でも public/assets 相対に揃える', () => {
    expect(normalizeAssetPath('brand/symbol.svg')).toBe('brand/symbol.svg');
    expect(normalizeAssetPath('/assets/brand/symbol.svg')).toBe('brand/symbol.svg');
    expect(normalizeAssetPath('assets/brand/symbol.svg')).toBe('brand/symbol.svg');
    expect(normalizeAssetPath('/URAMEKU/assets/brand/symbol.svg')).toBe('brand/symbol.svg');
    expect(normalizeAssetPath('public/assets/brand/symbol.svg')).toBe('brand/symbol.svg');
    expect(normalizeAssetPath('/brand/symbol.svg')).toBe('brand/symbol.svg');
  });

  it('isKnownAsset は収録済みを true、未収録を false にする', () => {
    expect(isKnownAsset('characters/shinobu/poses/point.png')).toBe(true);
    expect(isKnownAsset('/URAMEKU/assets/characters/shinobu/poses/point.png')).toBe(true);
    expect(isKnownAsset('characters/mega/poses/point.png')).toBe(false);
    expect(isKnownAsset('ui/icon.svg')).toBe(false);
  });

  it('実行時コードから assetManifest を import していない（バンドルに含めない）', () => {
    const srcDir = resolve(ROOT, 'src');
    const offenders = walk(srcDir)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /from\s+['"][^'"]*assetManifest['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
