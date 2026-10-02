import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * Atlas, le générateur de mondes (projet Vite dans `atlas/`), est construit
   * dans `public/atlas/`. Next sert ses fichiers tels quels ; il ne manque que
   * l'entrée : `/atlas` affiche son `index.html` sans changer l'adresse.
   */
  async rewrites() {
    return [{ source: "/atlas", destination: "/atlas/index.html" }];
  },

  async headers() {
    return [
      {
        // Fichiers d'Atlas nommés par leur empreinte : ils ne changent jamais.
        source: "/atlas/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  /**
   * L'ancien site exposait des pages qui n'ont plus d'équivalent direct.
   * Redirections permanentes plutôt que 404 : les liens entrants et le
   * référencement acquis sont transférés vers la page la plus proche.
   */
  async redirects() {
    return [
      { source: "/about", destination: "/cv", permanent: true },
      { source: "/work", destination: "/#projets", permanent: true },
      { source: "/gallery", destination: "/", permanent: true },
      // Project Climat a été renommé Corpus Delta.
      {
        source: "/work/project-climat",
        destination: "/work/corpus-delta",
        permanent: true,
      },
      // Noxus a quitté la sélection ; Atlas a pris sa place.
      { source: "/work/noxus", destination: "/work/atlas", permanent: true },
    ];
  },
};

export default nextConfig;
