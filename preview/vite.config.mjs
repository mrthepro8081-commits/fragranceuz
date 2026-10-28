import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  configFile: false,
  plugins: [
    react(),
    {
      // Swap in the preview's relaxed product rules everywhere except inside that file itself.
      name: 'preview-validation',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (/lib\/validation$/.test(source) && !importer?.endsWith('preview/validation.ts')) return fileURLToPath(new URL('./validation.ts', import.meta.url));
      },
    },
  ],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: fileURLToPath(new URL('../dist-preview', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)), output: { inlineDynamicImports: true } },
  },
});
