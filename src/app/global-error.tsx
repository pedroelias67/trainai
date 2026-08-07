"use client";

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
    <html lang="pt">
      <body style={{ background: "#0a0a0a", color: "#fff", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "32px" }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</p>
          <h1 style={{ fontSize: "20px", marginBottom: "8px" }}>Ocorreu um erro inesperado</h1>
          <p style={{ color: "#71717a", fontSize: "14px", marginBottom: "24px" }}>
            O problema foi registado automaticamente. Podes tentar novamente.
          </p>
          <button
            onClick={reset}
            style={{ background: "#22c55e", color: "#000", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
