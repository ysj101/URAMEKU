/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 公開 URL のベースパス（MVP-004 で確定）。
 * - 本番: GitHub Pages プロジェクトサイト `https://<owner>.github.io/URAMEKU/` → `/URAMEKU/`
 * - 開発・プレビュー: ルート `/`
 * `VITE_BASE_PATH` はシェル環境変数、または `.env.production` 等の .env ファイルで指定する。
 * 先頭・末尾のスラッシュは自動で補う（`URAMEKU` → `/URAMEKU/`）。
 */
export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBasePath(process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH);

  return {
    base,
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: 'es2022',
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      css: false,
    },
  };
});
