import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        hub: resolve(root, 'index.html'),
        arrakis: resolve(root, 'arrakis/index.html'),
        universe: resolve(root, 'universe/index.html'),
      },
    },
  },
  server: { port: 5173 },
});
