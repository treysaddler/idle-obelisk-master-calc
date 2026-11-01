import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works from any GitHub Pages path (user.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [preact()],
});
