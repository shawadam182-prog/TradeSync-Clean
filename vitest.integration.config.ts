import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules'],
    // Integration tests run sequentially to avoid conflicts
    pool: 'forks',
    isolate: false,
    // Longer timeout for network operations
    testTimeout: 30000,
    hookTimeout: 30000,
    // Load test environment variables
    env: {
      NODE_ENV: 'test',
    },
  },
});
