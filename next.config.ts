import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

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
