import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: [
        'dist/**',
        'tests/**',
        'src/index.ts',
        'src/types.ts',
        'src/constants.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 60,
        statements: 85,
      },
    },
  },
});
