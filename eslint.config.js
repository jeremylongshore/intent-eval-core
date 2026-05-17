// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'reports/**',
      '*.config.js',
      '*.config.ts',
      '*.cjs',
      '.husky/**',
      // test-d/ is owned by tsd — runs against dist/ as a separate process.
      // ESLint's typed lint would need test-d in tsconfig, but test-d
      // explicitly imports from dist/ which is post-build territory.
      'test-d/**',
      // _generated/ is json-schema-to-zod codegen output (see
      // src/validators/v1/_generated/README.md) — reference material, not
      // canonical. Not exported, not consumed at runtime, not linted.
      'src/validators/v1/_generated/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
);
