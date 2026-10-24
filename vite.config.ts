/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 公開 URL のベースパス（例: GitHub Pages のサブパス）は環境変数で切り替える。
// 詳細な方針は MVP-004 で確定する。
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
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
});
