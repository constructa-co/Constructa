/**
 * Minimal observability wrapper.
 *
 * Sprint 58 Phase 1 item #9. Perplexity audit flagged "no error tracking
 * (Sentry etc.) — production errors are invisible unless users report
 * them". This module is the seam where a real provider (Sentry, Axiom,
 * Logtail, etc.) can be wired in without touching every call site.
 *
 * Design principles:
 *   1. Zero external deps today — calling `reportError()` is always
 *      safe and just writes to console. This keeps the dep tree clean
 *      and means we don't pay for weighty instrumentation until it's
 *      actually needed.
 *   2. Feature-detect at runtime. When `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
 *      environment variables are set AND the `@sentry/nextjs` package is
 *      installed, calls will be forwarded there automatically via a
 *      dynamic import. No code changes needed to opt in — just:
 *        `npm install @sentry/nextjs`
 *        set env vars in Vercel
 *        deploy.
 *   3. Fire-and-forget. `reportError` is sync-friendly so it can be
 *      called from React error boundaries, which cannot await.
 *
 * Every existing error surface in the app should call `reportError()`
 * instead of `console.error()` going forward. Sprint 58 P1.9 wires it
 * into the `dashboard/error.tsx` and `dashboard/projects/error.tsx`
 * boundaries added in P1.1.
 */

type SentryLike = {
    captureException?: (err: unknown, context?: Record<string, unknown>) => void;
};

let cachedSentry: SentryLike | null = null;
let sentryProbed = false;

/**
 * Best-effort lazy resolution of the Sentry SDK. Returns null if the
 * package isn't installed or the DSN isn't configured, so callers can
 * safely no-op. Wrapped in try/catch so a broken install never crashes
 * the error boundary itself.
 */
async function resolveSentry(): Promise<SentryLike | null> {
    if (sentryProbed) return cachedSentry;
    sentryProbed = true;

    const dsn =
        process.env.SENTRY_DSN ??
        process.env.NEXT_PUBLIC_SENTRY_DSN ??
        null;
    if (!dsn) return null;

    try {
        // Dynamic import so a missing package doesn't break the build.
        // @ts-expect-error — optional dep not in package.json yet
        const mod = await import("@sentry/nextjs");
        cachedSentry = mod as SentryLike;
        return cachedSentry;
    } catch {
        return null;
    }
}

export interface ErrorContext {
    /** Freeform source tag — e.g. "dashboard-error-boundary". */
    source?: string;
    /** Next.js server component digest (only present on server errors). */
    digest?: string;
    /** Arbitrary key/value context. No PII please. */
    extra?: Record<string, unknown>;
}

/**
 * Report an error to observability. Always writes to console first so
 * Vercel logs capture it, then forwards to Sentry if configured.
 * Safe to call from React error boundaries, server actions, or anywhere
 * else an unhandled error surfaces.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
    const source = context.source ?? "app";
    const digest = context.digest;

    // 1. Always log — shows up in Vercel logs regardless of provider.
    if (error instanceof Error) {
        console.error(
            `[${source}] ${error.name}: ${error.message}`,
            { digest, extra: context.extra, stack: error.stack },
        );
    } else {
        console.error(`[${source}]`, error, { digest, extra: context.extra });
    }

    // 2. Fire-and-forget to Sentry if available. We deliberately don't
    //    await this — React error boundaries are sync, and holding them
    //    up for a network call would make the UX worse not better.
    void resolveSentry().then((sentry) => {
        if (!sentry?.captureException) return;
        try {
            sentry.captureException(error, {
                tags: { source },
                extra: { digest, ...(context.extra ?? {}) },
            });
        } catch {
            // Swallow — we already logged above.
        }
    });
}
