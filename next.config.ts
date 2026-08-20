import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * Les visuels des projets sont pour l'instant des placeholders Lorem Picsum.
   * Cette entrée disparaît avec eux, dès que les vraies captures sont dans
   * `public/work/`.
   */
  images: {
    remotePatterns: [new URL("https://picsum.photos/seed/**")],
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
    ];
  },
};

export default nextConfig;
