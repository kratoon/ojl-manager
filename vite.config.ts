import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localDataPlugin } from './tools/dataPlugin';

// GitHub Pages ready (ADR): the base path is configurable and defaults to relative,
// so the static build works at any path. Example for project pages:
//   BASE_PATH=/ojl-manager/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react(), localDataPlugin()],
  // The PDF export (pdf-lib + fontkit) is loaded on demand, so its chunk is big but not on the first load.
  build: { chunkSizeWarningLimit: 800 },
  server: { host: '127.0.0.1' },
});
