import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// If deploying to a project page like username.github.io/vinyl-investigator,
// set BASE_PATH to '/vinyl-investigator'. For a user/org page or custom domain,
// leave it as ''.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // SPA fallback so deep links work on GitHub Pages
      precompress: false,
      strict: true
    }),
    paths: { base },
    serviceWorker: { register: true },
    prerender: {
      handleHttpError: ({ path, message }) => {
        // The PWA icons (icon-192.png / icon-512.png) are not committed yet — they
        // are generated separately. Treat their 404s as warnings so the build can
        // succeed. Anything else is still a hard error.
        if (path === '/icon-192.png' || path === '/icon-512.png') {
          console.warn(`prerender: skipping missing asset ${path}`);
          return;
        }
        throw new Error(message);
      }
    }
  }
};

export default config;
