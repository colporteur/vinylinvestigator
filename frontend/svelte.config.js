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
    serviceWorker: { register: true }
  }
};

export default config;
