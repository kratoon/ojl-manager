import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.idea/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // No hardcoded labels: all UI text comes from src/i18n/labels.ts.
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'JSXText[value=/\\S/]', message: 'Do not hardcode labels in JSX; add them to src/i18n/labels.ts.' },
      ],
    },
  },
);
