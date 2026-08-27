import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Next.js calls this for errors thrown while rendering on the server. Without it
 * nothing reports failures inside server components — the pages that read the
 * database directly, which is most of the dashboard.
 */
export const onRequestError = Sentry.captureRequestError;
