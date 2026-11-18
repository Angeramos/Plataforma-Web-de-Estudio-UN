import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse usa pdfjs-dist, que carga su worker desde su propia carpeta: empaquetado por Next lo pierde.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
