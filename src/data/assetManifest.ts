/**
 * アセットマニフェスト（`assets.manifest.json`）の参照ヘルパー。
 *
 * マニフェストは約 200KB あり、アプリのバンドルには含めない。
 * このモジュールは **テスト（Vitest）とビルド時スクリプトからだけ** 使い、
 * `src/app` / `src/components` / `src/screens` など実行時コードから import しないこと
 * （`assetManifest.test.ts` が import の有無を検査する）。
 *
 * 読み込みは `node:fs` による遅延読み込みで、初回呼び出し時に 1 度だけ行う。
 */
// tsconfig.json は `types: ["vitest/globals"]` で Node の型を自動では含めないため、
// このテスト/ビルド時専用モジュールだけで明示的に参照する。
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ManifestEntry {
  /** リポジトリルートからの相対パス（例: `public/assets/brand/symbol.svg`） */
  path: string;
  category: string;
  bytes: number;
  format: string;
  exists: boolean;
  sha256: string;
  size?: [number, number];
  alpha?: boolean;
  source: string;
  art_review: string;
}

export interface AssetManifest {
  product: string;
  version: string;
  generatedAt: string;
  asset_count: number;
  assets: ManifestEntry[];
}

/** マニフェスト上のパス接頭辞。これを除いたものが `assetUrl()` の引数と一致する。 */
export const MANIFEST_PREFIX = 'public/assets/';

/**
 * マニフェストの絶対パス。Vitest（jsdom 環境）では `import.meta.url` が `http:` になるため、
 * カレントディレクトリ（= リポジトリルート。vite の root）基準で解決する。
 */
export const MANIFEST_FILE = resolve(process.cwd(), 'assets.manifest.json');

let cached: AssetManifest | undefined;
let cachedPaths: Set<string> | undefined;

/** マニフェスト全体（遅延読み込み・キャッシュ）。 */
export function loadManifest(): AssetManifest {
  if (!cached) {
    cached = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as AssetManifest;
  }
  return cached;
}

/**
 * `assetUrl()` に渡す形式（`public/assets/` からの相対パス）で、
 * マニフェストに載っている全パスを返す。
 */
export function manifestPaths(): Set<string> {
  if (!cachedPaths) {
    cachedPaths = new Set(
      loadManifest()
        .assets.filter((a) => a.path.startsWith(MANIFEST_PREFIX))
        .map((a) => a.path.slice(MANIFEST_PREFIX.length)),
    );
  }
  return cachedPaths;
}

/**
 * 受け取ったパスを `public/assets/` からの相対パスに正規化する。
 * 次のどの形式でも受け付ける:
 * - `brand/symbol.svg`（`assetUrl()` の引数）
 * - `assets/brand/symbol.svg` / `/assets/brand/symbol.svg`（`public/` 相対・ルート配信 URL）
 * - `/URAMEKU/assets/brand/symbol.svg`（サブパス配信 URL）
 * - `public/assets/brand/symbol.svg`（マニフェスト上のパス）
 */
export function normalizeAssetPath(input: string): string {
  const marker = 'assets/';
  const index = input.indexOf(marker);
  const rest = index >= 0 ? input.slice(index + marker.length) : input;
  return rest.replace(/^\/+/, '');
}

/** 与えたパスがマニフェストに載っているか。 */
export function isKnownAsset(relativePath: string): boolean {
  return manifestPaths().has(normalizeAssetPath(relativePath));
}

/** テスト用: キャッシュを破棄する。 */
export function resetManifestCache(): void {
  cached = undefined;
  cachedPaths = undefined;
}
