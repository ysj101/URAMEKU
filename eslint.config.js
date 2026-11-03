// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'prototype/**',
      'previews/**',
      'public/**',
      'design/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // 画面の a11y（alt、ラベル、role と操作の対応など）。docs/UI_GUIDE_LINT.md
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    // UI 設計ガイド（docs/UI_GUIDE_LINT.md）。文言と配色は scripts/lint_ui_guide.mjs が見る
    files: ['src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      // 確認は画面内の 2 段階ボタンで出す。ネイティブダイアログは OK / キャンセルしか出せない
      'no-restricted-globals': [
        'error',
        ...['confirm', 'alert', 'prompt'].map((name) => ({
          name,
          message: `${name}() は使わない。画面内の確認（例: ResetProgressPanel）にして、ボタンは「削除する」「やめる」のように結果が分かる動詞にする`,
        })),
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis'].flatMap((object) =>
          ['confirm', 'alert', 'prompt'].map((property) => ({
            object,
            property,
            message: `${object}.${property}() は使わない。画面内の確認にして、ボタンは結果が分かる動詞にする`,
          })),
        ),
      ],
      'no-restricted-syntax': [
        'error',
        {
          // role="tab" のボタンは矢印キーで移動できるようにする（図鑑のタブと同じ振る舞い）
          selector:
            'JSXOpeningElement:has(JSXAttribute[name.name="role"] > Literal[value="tab"]):not(:has(JSXAttribute[name.name="onKeyDown"])):not(:has(JSXSpreadAttribute))',
          message:
            'role="tab" には onKeyDown を付けて、左右の矢印キー・Home・End でタブを移動できるようにする（EncyclopediaScreen の onTabKeyDown と同じ）',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
