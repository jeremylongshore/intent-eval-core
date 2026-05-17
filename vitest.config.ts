import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/**/index.ts',
        // _generated/ is json-schema-to-zod codegen reference output (see
        // src/validators/v1/_generated/README.md). Not the canonical API
        // surface, not exported, not consumer-facing — excluded from
        // coverage to keep the 100% floor meaningful.
        'src/validators/v1/_generated/**',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
