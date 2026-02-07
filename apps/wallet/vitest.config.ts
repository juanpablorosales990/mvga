import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const walletModules = path.resolve(__dirname, 'node_modules');

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Force single React instance (wallet's own copy, 18.3.x)
      // Prevents dual-React issue with monorepo root (18.2.0)
      'react/jsx-runtime': path.join(walletModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': path.join(walletModules, 'react/jsx-dev-runtime'),
      'react-dom/client': path.join(walletModules, 'react-dom/client'),
      'react-dom/test-utils': path.join(walletModules, 'react-dom/test-utils'),
      react: path.join(walletModules, 'react'),
      'react-dom': path.join(walletModules, 'react-dom'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Prevent Playwright e2e specs from being executed by Vitest.
    exclude: ['e2e/**'],
  },
});
