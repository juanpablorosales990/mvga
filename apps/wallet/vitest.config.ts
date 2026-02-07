import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const rootModules = path.resolve(__dirname, '../../node_modules');

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Force single React instance from monorepo root
      'react/jsx-runtime': path.join(rootModules, 'react/jsx-runtime'),
      'react/jsx-dev-runtime': path.join(rootModules, 'react/jsx-dev-runtime'),
      'react-dom/client': path.join(rootModules, 'react-dom/client'),
      'react-dom/test-utils': path.join(rootModules, 'react-dom/test-utils'),
      react: path.join(rootModules, 'react'),
      'react-dom': path.join(rootModules, 'react-dom'),
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
