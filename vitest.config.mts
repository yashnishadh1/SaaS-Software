import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/bizflow_test',
      FIREBASE_PROJECT_ID: 'test-project',
      NODE_ENV: 'test',
    },
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.spec.ts',
      'services/*/src/**/*.test.ts',
      'services/*/src/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
    reporters: ['verbose'],
  },
});
