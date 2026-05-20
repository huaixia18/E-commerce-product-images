// Next.js instrumentation hook — wires up server + edge Sentry configs.
// Runs once per runtime at startup. The configs themselves no-op without
// a DSN, so this is safe to keep unconditionally.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
