import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    // TinyMCE's ESM npm-import self-hosting pattern (Webpack's approach) doesn't reliably
    // initialize under Vite — the editor silently never mounts. Tiny's own Vite guide instead
    // copies the dist assets to a static path and loads them via a real <script src>.
    viteStaticCopy({
      targets: [{ src: 'node_modules/tinymce/**/*', dest: 'tinymce', rename: { stripBase: 2 } }],
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../TurboTikects-server/src/main/resources/static',
    emptyOutDir: true,
  },
})
