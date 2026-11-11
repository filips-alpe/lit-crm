import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    // *.testutil.ts are test fixtures: only tests may import them, so they can never reach a bundle.
    files: ['**/*.ts', '**/*.svelte', '**/*.js'],
    ignores: ['**/*.test.ts', '**/*.spec.ts', '**/*.testutil.ts', 'vitest.setup.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/*.testutil', '**/*.testutil.ts'], message: 'Test-only module.' },
            // The same, spelled as a relative path (src/extensions/** included).
            {
              group: ['**/prisma', '**/prisma.ts'],
              importNames: ['prismaOwner'],
              message: 'prismaOwner bypasses row-level security (tests, seeds and scripts only).',
            },
          ],
          // The owner connection bypasses row-level security: app code must use the scoped
          // `prisma` (every operation runs as lit_app for the request's user).
          paths: [
            {
              name: '$lib/prisma',
              importNames: ['prismaOwner'],
              message: 'prismaOwner bypasses row-level security (tests, seeds and scripts only).',
            },
          ],
        },
      ],
    },
  },
  {
    // Extension code is bundled for the browser unless it is server-side: SvelteKit refuses
    // $lib/server and *.server modules there, but nothing else in an extension folder. So only
    // *.server.ts and seeds may import server code; type imports are fine. (An extension's
    // routes/ are installed into src/routes, where SvelteKit's own rules apply.)
    files: ['src/extensions/**/*.ts', 'src/extensions/**/*.svelte'],
    ignores: [
      '**/*.test.ts',
      'src/extensions/**/*.server.ts',
      'src/extensions/*/seed.ts',
      'src/extensions/*/seed/**',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/server',
                '**/server.ts',
                '**/*.server',
                '**/*.server.ts',
                '$lib/server/**',
              ],
              allowTypeImports: true,
              message:
                'Server-only code: import it from a *.server.ts file, never from a component or page.',
            },
          ],
        },
      ],
    },
  },
  {
    // Override or add rule settings here, such as:
    // 'svelte/button-has-type': 'error'
    rules: {},
  },
);
