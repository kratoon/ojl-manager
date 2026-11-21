import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localDataPlugin } from './tools/dataPlugin.ts';

// The app version comes from package.json (maintained by release-please, ADR-ca37db3).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// GitHub Pages ready (ADR): the base path is configurable and defaults to relative,
// so the static build works at any path. Example for project pages:
//   BASE_PATH=/ojl-manager/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), localDataPlugin()],
  // The PDF export (pdf-lib + fontkit) is loaded on demand, so its chunk is big but not on the first load.
  build: { chunkSizeWarningLimit: 800 },
  server: { host: '127.0.0.1' },
});
