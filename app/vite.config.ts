import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // `npm run dev:phone` serves over self-signed HTTPS on your LAN — browsers only allow
  // camera access (live QR scanning) on HTTPS or localhost.
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
