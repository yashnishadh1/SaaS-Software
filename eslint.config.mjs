// ESLint flat-config (eslint.config.mjs) for the entire monorepo
// Requires eslint@9+

import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ── Files to lint ──────────────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs['strict-type-checked'].rules,
      ...tsPlugin.configs['stylistic-type-checked'].rules,
      'prettier/prettier': 'error',
      // Allow unused vars prefixed with _ (common convention)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // ── Test files overrides ──────────────────────────────────────────────────
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // ── JS files (config files, scripts) ──────────────────────────────────────
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      // Prisma generated client
      '**/node_modules/.prisma/**',
      '**/.prisma/**',
    ],
  },
  // ── Disable style rules that Prettier owns ────────────────────────────────
  prettierConfig,
];
