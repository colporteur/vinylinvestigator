import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true, // listen on 0.0.0.0 so you can hit it from your phone over LAN
    port: 5173
  }
});
