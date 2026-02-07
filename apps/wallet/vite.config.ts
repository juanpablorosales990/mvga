import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const NODE_MAJOR = Number(process.versions.node.split('.')[0] || 0);
// Workbox uses Rollup+Terser when `mode: 'production'`. This currently flakes on
// very new Node majors (observed on Node 25). Use the non-minified dev mode
// locally to keep builds reliable; CI/Vercel (Node 18/20) will still use prod.
const WORKBOX_MODE = NODE_MAJOR >= 25 ? 'development' : 'production';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: [
        'buffer',
        'crypto',
        'stream',
        'util',
        'events',
        'http',
        'https',
        'os',
        'url',
        'zlib',
        'path',
        'assert',
      ],
      globals: { Buffer: true, process: true },
      protocolImports: true,
    }),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'] },
      manifest: {
        name: 'MVGA Wallet',
        short_name: 'MVGA',
        description: "Venezuela's open-source crypto wallet",
        theme_color: '#f59e0b',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({ org: 'mvga', project: 'wallet' })]
      : []),
  ],
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      '@': '/src',
      'vite-plugin-node-polyfills/shims/buffer': path.resolve(
        __dirname,
        '../../node_modules/vite-plugin-node-polyfills/shims/buffer'
      ),
      'vite-plugin-node-polyfills/shims/global': path.resolve(
        __dirname,
        '../../node_modules/vite-plugin-node-polyfills/shims/global'
      ),
      'vite-plugin-node-polyfills/shims/process': path.resolve(
        __dirname,
        '../../node_modules/vite-plugin-node-polyfills/shims/process'
      ),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'solana-adapters': ['@solana/wallet-adapter-react'],
          'solana-web3': ['@solana/web3.js', '@solana/spl-token'],
        },
      },
    },
  },
});
