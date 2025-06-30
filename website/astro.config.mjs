import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeUrls from 'rehype-urls';
import bundleAudioWorkletPlugin from 'vite-plugin-bundle-audioworklet';
import tailwind from '@astrojs/tailwind';
import AstroPWA from '@vite-pwa/astro';
import netlify from '@astrojs/netlify';

const site = `https://strudel.cc`; // root url without a path
const base = '/'; // base path of the strudel site
const baseNoTrailing = base.endsWith('/') ? base.slice(0, -1) : base;

// this rehype plugin fixes relative links
function relativeURLFix() {
  return (tree, file) => {
    const chunks = file.history[0].split('/src/pages/');
    const path = chunks[chunks.length - 1].slice(0, -4);
    return rehypeUrls((url) => {
      let newHref = baseNoTrailing;
      if (url.href.startsWith('#')) {
        newHref += `/${path}/${url.href}`;
      } else if (url.href.startsWith('/')) {
        newHref += url.pathname;
        if (url.pathname.indexOf('.') == -1) {
          newHref += url.pathname.endsWith('/') ? '' : '/';
        }
        newHref += url.search || '';
        newHref += url.hash || '';
      } else {
        return;
      }
      return newHref;
    })(tree);
  };
}

const mdxOptions = {
  remarkPlugins: [remarkToc],
  rehypePlugins: [
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: 'append' }],
    relativeURLFix
  ],
  gfm: true,
  smartypants: true,
};

// https://astro.build/config
export default defineConfig({
  integrations: [
    react({
      include: ['**/*.{jsx,tsx}'],
      ssr: true
    }),
    mdx(mdxOptions),
    tailwind({
      config: { path: './tailwind.config.mjs' }
    }),
    AstroPWA({
      experimental: { directoryAndTrailingSlashHandler: true },
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        maximumFileSizeToCacheInBytes: 4194304,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wav,mp3,ogg,ttf,woff2,TTF,otf}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              [
                /^https:\/\/raw\.githubusercontent\.com\/.*/i,
                /^https:\/\/freesound\.org\/.*/i,
                /^https:\/\/cdn\.freesound\.org\/.*/i,
                /^https:\/\/shabda\.ndre\.gr\/.*/i,
              ].some((regex) => regex.test(url)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-samples',
              expiration: {
                maxEntries: 5000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        includeAssets: ['favicon.ico', 'icons/apple-icon-180.png'],
        name: 'Strudel REPL',
        short_name: 'Strudel',
        description:
          'Strudel is a music live coding environment for the browser, porting the TidalCycles pattern language to JavaScript.',
        theme_color: '#222222',
        icons: [
          {
            src: 'icons/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],

  site,
  base,

  vite: {
    plugins: [bundleAudioWorkletPlugin()],
    build: {
      rollupOptions: {
        external: ['/doc.json'],
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'astro-vendor': ['astro']
          }
        }
      },
      cssCodeSplit: true,
      sourcemap: true
    },
    optimizeDeps: {
      exclude: ['doc.json'],
      include: ['react', 'react-dom']
    },
    ssr: {
      noExternal: true,
      external: ['cssesc', 'node:*']
    }
  },

  output: 'server',
  adapter: netlify({
    edgeMiddleware: false,
    functionPerRoute: false,
    split: false
  }),
});