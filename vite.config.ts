import { defineConfig } from 'vite';

export default defineConfig({
  // manifold-3d locates its .wasm via import.meta.url; pre-bundling breaks that.
  optimizeDeps: { exclude: ['manifold-3d'] },
  server: { port: 5190 },
});
