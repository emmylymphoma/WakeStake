import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Cross-origin isolation lets bb.js prove with multiple threads (SharedArrayBuffer).
// `credentialless` instead of `require-corp` so Google Fonts still load.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig(({ mode }) => ({
  // `npm run dev:phone` serves over self-signed HTTPS on your LAN — browsers only allow
  // camera access (live QR scanning) on HTTPS or localhost.
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  // The Noir/bb.js wasm packages break when pre-bundled, and use top-level await.
  optimizeDeps: { exclude: ['@noir-lang/noirc_abi', '@noir-lang/acvm_js'] },
  build: { target: 'esnext' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
