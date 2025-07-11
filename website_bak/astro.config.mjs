import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'path';

export default defineConfig({
  integrations: [
    react({
      include: ['**/react/*', '**/components/**/*.jsx', '**/repl/**/*.jsx'],
      experimentalReactChildren: true
    }), 
    tailwind()
  ],
  output: 'static',
  site: 'https://strudel-ai.netlify.app',
  vite: {
    resolve: {
      alias: {
        '@src': path.resolve('./src'),
        '@components': path.resolve('./src/components'),
        '@strudel/core': path.resolve('../packages/core'),
        '@strudel/draw': path.resolve('../packages/draw'),
        '@strudel/hydra': path.resolve('../packages/hydra'),
        '@strudel/mini': path.resolve('../packages/mini'),
        '@strudel/tonal': path.resolve('../packages/tonal'),
        '@strudel/xen': path.resolve('../packages/xen'),
        '@strudel/webaudio': path.resolve('../packages/webaudio'),
        '@strudel/codemirror': path.resolve('../packages/codemirror'),
        '@strudel/soundfonts': path.resolve('../packages/soundfonts'),
        '@strudel/csound': path.resolve('../packages/csound'),
        '@strudel/tidal': path.resolve('../packages/tidal'),
        '@strudel/gamepad': path.resolve('../packages/gamepad'),
        '@strudel/motion': path.resolve('../packages/motion'),
        '@strudel/mqtt': path.resolve('../packages/mqtt'),
        '@strudel/midi': path.resolve('../packages/midi'),
        '@strudel/osc': path.resolve('../packages/osc'),
        '@strudel/desktopbridge': path.resolve('../packages/desktopbridge')
      }
    },
    optimizeDeps: {
      exclude: ['@strudel/webaudio']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'audio-worklet': ['@strudel/webaudio']
          }
        }
      }
    }
  }
});