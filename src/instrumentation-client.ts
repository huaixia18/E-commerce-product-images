// Browser-side Sentry init. Next.js loads this on the client automatically.
// Gated on NEXT_PUBLIC_SENTRY_DSN so it stays silent in local dev.

import * as Sentry from "@sentry/nextjs";
import { sentryEnabled, baseSentryOptions } from "@/lib/sentry.shared";

if (sentryEnabled) {
  Sentry.init({
    ...baseSentryOptions,
    // Replay/session features off — error capture only.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
