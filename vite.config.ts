/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// A relative base lets the built site run from any path, such as a GitHub Pages
// project site at https://<user>.github.io/<repo>/.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts'] },
});
