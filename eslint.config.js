import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // TypeScript + `tsc --noEmit` already resolve identifiers; core no-undef only
    // produces false positives on DOM/GM globals here.
    rules: {
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['test/**/*.ts', '*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
