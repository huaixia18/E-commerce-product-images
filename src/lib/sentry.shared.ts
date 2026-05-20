// Shared Sentry options used by client / server / edge / worker inits.
// Everything is gated on SENTRY_DSN: if it's unset (e.g. local dev), the
// SDK is never initialized, so there's zero noise and zero network calls.

export const SENTRY_DSN =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export const sentryEnabled = SENTRY_DSN.length > 0;

export const baseSentryOptions = {
  dsn: SENTRY_DSN,
  // Error monitoring only — no performance tracing (keeps event volume low
  // and avoids burning a self-hosted instance's storage).
  tracesSampleRate: 0,
  // Don't send PII (IP, cookies, request bodies) by default. We attach
  // explicit context (order id, job id) where it's safe.
  sendDefaultPii: false,
  environment: process.env.NODE_ENV ?? "development",
};
