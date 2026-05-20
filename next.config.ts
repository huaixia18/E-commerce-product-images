import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // ali-oss pulls in urllib which conditionally require()s `proxy-agent` at
  // runtime; bundling it breaks Turbopack's static analysis. Keep it external.
  // archiver is also CJS and Turbopack's interop breaks its callable export.
  serverExternalPackages: ["ali-oss", "archiver"],
};

// Only enable Sentry's build-time plugin (source-map upload etc) when the
// upload credentials are present. Otherwise withSentryConfig is a near no-op
// that just injects the runtime SDK — and crucially, it won't fail the build
// in environments without SENTRY_AUTH_TOKEN (local dev, CI without secrets).
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Self-hosted Sentry: point the plugin at your instance.
  sentryUrl: process.env.SENTRY_URL,
  silent: true,
  // Don't upload source maps unless we actually have a token.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Tunnel browser events through our own origin to dodge ad-blockers.
  tunnelRoute: "/monitoring",
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
