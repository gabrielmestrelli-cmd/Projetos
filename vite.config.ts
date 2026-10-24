import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Cada publicação gera nomes de arquivo novos: nunca reaproveita um endereço que algum
// navegador possa ter guardado como "não encontrado" (o Safari guardava e a página ficava branca).
const BUILD_ID = Date.now().toString(36);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-${BUILD_ID}-[hash].js`,
          chunkFileNames: `assets/[name]-${BUILD_ID}-[hash].js`,
          assetFileNames: `assets/[name]-${BUILD_ID}-[hash][extname]`,
          // Bibliotecas em arquivos separados: o navegador guarda em cache entre atualizações do site
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            ui: ['motion', '@base-ui/react', 'sonner'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
