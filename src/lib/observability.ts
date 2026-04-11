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
 *
 * Implementation note: Next.js / Webpack statically analyses
 * `import("...")` string literals and will fail the build if the module
 * isn't on disk — even inside try/catch. To keep `@sentry/nextjs` a
 * TRULY optional dependency (no package.json entry, no bundling cost,
 * no build failure when missing) we go through `eval("require")`.
 * The `eval` call is NEVER reached unless `SENTRY_DSN` is set, so in
 * normal operation this is zero-overhead.
 */
function resolveSentry(): SentryLike | null {
    if (sentryProbed) return cachedSentry;
    sentryProbed = true;

    const dsn =
        process.env.SENTRY_DSN ??
        process.env.NEXT_PUBLIC_SENTRY_DSN ??
        null;
    if (!dsn) return null;

    // Server-side runtime only. `eval("require")` is an ESLint smell but
    // it's the canonical way to hide a dynamic require from bundlers —
    // exactly what we want for an opt-in observability provider.
    if (typeof window !== "undefined") return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
        const req = eval("require") as NodeRequire;
        cachedSentry = req("@sentry/nextjs") as SentryLike;
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

    // 2. Fire-and-forget to Sentry if available. `resolveSentry()` is
    //    sync and returns null unless the DSN is set AND the package is
    //    installed on the server — so this is a pure no-op in normal
    //    operation.
    const sentry = resolveSentry();
    if (sentry?.captureException) {
        try {
            sentry.captureException(error, {
                tags: { source },
                extra: { digest, ...(context.extra ?? {}) },
            });
        } catch {
            // Swallow — we already logged above.
        }
    }
}
