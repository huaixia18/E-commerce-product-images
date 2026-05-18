import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // ali-oss pulls in urllib which conditionally require()s `proxy-agent` at
  // runtime; bundling it breaks Turbopack's static analysis. Keep it external.
  serverExternalPackages: ["ali-oss"],
};

export default nextConfig;
