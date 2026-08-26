import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // sql.js ships an Emscripten CommonJS wrapper that must retain its own
      // `module.exports`. Bundling it causes that wrapper to receive Vite's
      // internal module placeholder instead and fail during initialization.
      external: ['sql.js', 'sql.js/dist/sql-wasm.js'],
    },
  },
});
