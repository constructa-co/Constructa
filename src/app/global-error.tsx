"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability";

/**
 * Root-level global error boundary. Catches errors that occur above the
 * /dashboard route group — e.g. in the root layout, auth layout, or
 * any top-level provider. Without this, a single unhandled error in
 * root layout would render a completely blank page with no recovery.
 *
 * Sprint 58 P1.1 + P1.9. Must render its own <html>/<body> because
 * the root layout is the one that errored.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        reportError(error, {
            source: "global-error-boundary",
            digest: error.digest,
        });
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    padding: 0,
                    minHeight: "100vh",
                    background: "#0a0a0a",
                    color: "#e2e8f0",
                    fontFamily:
                        "system-ui, -apple-system, 'Segoe UI', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        maxWidth: 480,
                        padding: 32,
                        borderRadius: 16,
                        border: "1px solid #1e293b",
                        background: "#0f172a",
                        textAlign: "center",
                    }}
                >
                    <h1
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 8,
                            color: "#f1f5f9",
                        }}
                    >
                        Something went wrong
                    </h1>
                    <p
                        style={{
                            fontSize: 14,
                            color: "#94a3b8",
                            lineHeight: 1.6,
                            marginBottom: 20,
                        }}
                    >
                        An unexpected error occurred. Your data is safe — we
                        were unable to render this page.
                    </p>
                    {error.digest && (
                        <p
                            style={{
                                fontSize: 10,
                                fontFamily: "monospace",
                                color: "#475569",
                                background: "#020617",
                                border: "1px solid #1e293b",
                                borderRadius: 4,
                                padding: "4px 8px",
                                marginBottom: 20,
                                display: "inline-block",
                            }}
                        >
                            ref: {error.digest}
                        </p>
                    )}
                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        <button
                            type="button"
                            onClick={() => reset()}
                            style={{
                                height: 40,
                                padding: "0 16px",
                                borderRadius: 8,
                                background: "#2563eb",
                                color: "white",
                                fontWeight: 600,
                                fontSize: 14,
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            Try again
                        </button>
                        <a
                            href="/dashboard/home"
                            style={{
                                height: 40,
                                lineHeight: "40px",
                                padding: "0 16px",
                                borderRadius: 8,
                                background: "#1e293b",
                                color: "#e2e8f0",
                                fontWeight: 600,
                                fontSize: 14,
                                border: "1px solid #334155",
                                textDecoration: "none",
                            }}
                        >
                            Dashboard
                        </a>
                    </div>
                </div>
            </body>
        </html>
    );
}
