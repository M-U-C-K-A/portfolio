import { defineConfig } from 'vite';

/**
 * Atlas est servi par le portfolio sous /atlas/ : les ressources sont cherchées sous ce préfixe et le
 * build est déposé dans public/atlas du site Next.js (dossier généré, ignoré par git).
 */
export default defineConfig({
  base: '/atlas/',
  worker: { format: 'es' },
  server: { port: 5173 },
  build: {
    outDir: '../public/atlas',
    emptyOutDir: true,
  },
});
