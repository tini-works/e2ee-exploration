import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {},
  // Docker deploy (dokploy/web): self-contained server in .next/standalone.
  output: "standalone",
  // Monorepo: trace from the repo root so the workspace package
  // (packages/matrix-client) is included in the standalone output.
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
