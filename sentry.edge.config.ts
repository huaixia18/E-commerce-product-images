// Edge runtime Sentry init (middleware). No-op when SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs";
import { sentryEnabled, baseSentryOptions } from "@/lib/sentry.shared";

if (sentryEnabled) {
  Sentry.init(baseSentryOptions);
}
