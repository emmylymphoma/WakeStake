import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;

/**
 * Real transactions against a local chain. Needs, from the repo root:
 *   pnpm hardhat node
 *   pnpm hardhat run scripts/deploy-local.ts --network localhost   (writes app/.env.local)
 * then `npm run test:e2e:chain` in app/.
 */
export default defineConfig({
  testDir: '.',
  outputDir: '../test-results/chain',
  timeout: 240_000,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // CHAIN_E2E_BUILD=1 tests the production build instead of the dev server.
    command: process.env.CHAIN_E2E_BUILD
      ? `npx vite build && npx vite preview --port ${PORT} --strictPort`
      : `npx vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
