import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeUrls from 'rehype-urls';
import bundleAudioWorkletPlugin from 'vite-plugin-bundle-audioworklet';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

const site = `https://strudel.cc`;
const base = '/';
const baseNoTrailing = base.endsWith('/') ? base.slice(0, -1) : base;

const mdxOptions = {
  remarkPlugins: [remarkToc],
  rehypePlugins: [
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    [
      rehypeUrls,
      (url) => {
        if (url.href?.startsWith('/')) {
          url.href = `${baseNoTrailing}${url.href}`;
        }
        return url;
      },
    ],
  ],
};

// https://astro.build/config
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 4321,
    cors: true
  },

  integrations: [
    react({
      include: ['**/*.{jsx,tsx}'],
      experimentalReactChildren: true
    }),
    mdx(mdxOptions),
    tailwind({
      config: { path: './tailwind.config.mjs' }
    })
  ],

  site,
  base,

  output: 'server',
  adapter: netlify({
    edgeMiddleware: false,
    functionPerRoute: false,
    split: true,
    assets: 'dist',
    dist: {
      client: 'dist/client',
      server: 'dist/server',
    }
  }),

  vite: {
    plugins: [bundleAudioWorkletPlugin()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'astro-vendor': ['astro'],
            'codemirror': ['@codemirror/state', '@codemirror/view', '@codemirror/language'],
            'csound': ['@csound/browser'],
            'audio': ['tone']
          }
        },
        external: ['@strudel/webaudio']
      },
      cssCodeSplit: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1000
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@strudel/core', '@strudel/webaudio', '@strudel/transpiler']
    },
    server: {
      host: '0.0.0.0',
      cors: true,
      hmr: {
        host: '0.0.0.0',
        clientPort: 4321,
        protocol: 'ws'
      }
    }
  }
});