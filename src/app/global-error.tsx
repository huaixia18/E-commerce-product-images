"use client";

// Top-level React error boundary. Reports the crash to Sentry (no-op without
// a DSN) and shows a minimal fallback. Must render its own <html>/<body>
// because it replaces the root layout when a render error escapes.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#FFF4E8",
          color: "#1A1208",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>😵</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>页面出错了</h1>
          <p style={{ color: "#7A5C3F", fontSize: 14, margin: "0 0 20px" }}>
            我们已记录这个问题，请稍后再试。
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: "#FF5A1F",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
