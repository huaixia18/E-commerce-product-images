// Server-side Sentry init (API routes, server components, route handlers).
// Loaded via instrumentation.ts. No-op when SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs";
import { sentryEnabled, baseSentryOptions } from "@/lib/sentry.shared";

if (sentryEnabled) {
  Sentry.init(baseSentryOptions);
}
