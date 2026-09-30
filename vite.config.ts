import { defineConfig, loadEnv } from 'vite';
import { offlinePlugin } from './build/offline.ts';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  let origin = '';
  try {
    const url = new URL(env.VITE_SITE_URL);
    if (url.protocol === 'https:') origin = url.origin;
  } catch {
    /* set real URL at deployment */
  }
  return {
    build: { target: 'es2022' },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    plugins: [
      offlinePlugin(),
      {
        name: 'share-metadata',
        transformIndexHtml() {
          return [
            {
              tag: 'meta',
              attrs: {
                property: 'og:image',
                content: `${origin}/og-cover.png`,
              },
              injectTo: 'head' as const,
            },
            {
              tag: 'meta',
              attrs: {
                name: 'twitter:image',
                content: `${origin}/og-cover.png`,
              },
              injectTo: 'head' as const,
            },
            ...(origin
              ? [
                  {
                    tag: 'link',
                    attrs: { rel: 'canonical', href: `${origin}/` },
                    injectTo: 'head' as const,
                  },
                  {
                    tag: 'meta',
                    attrs: { property: 'og:url', content: `${origin}/` },
                    injectTo: 'head' as const,
                  },
                ]
              : []),
          ];
        },
      },
    ],
  };
});
