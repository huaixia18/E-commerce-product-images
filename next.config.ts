import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // ali-oss pulls in urllib which conditionally require()s `proxy-agent` at
  // runtime; bundling it breaks Turbopack's static analysis. Keep it external.
  // archiver is also CJS and Turbopack's interop breaks its callable export.
  serverExternalPackages: ["ali-oss", "archiver"],
};

export default nextConfig;
