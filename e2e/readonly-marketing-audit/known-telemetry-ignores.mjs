/**
 * Console / request failures that are recorded as ignored — never counted as pass.
 * Each entry must cite repo source for why it is expected in read-only CI.
 */
export const KNOWN_TELEMETRY_IGNORES = [
  {
    id: "vercel-web-analytics-script",
    kind: "console",
    pattern:
      /vercel-insights|_vercel\/insights|vitals\.vercel-insights\.com|@vercel\/analytics/i,
    reason:
      "Vercel Web Analytics is gated by NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS and mounts client-side only on public routes (src/lib/public-measurement.ts, src/components/public-analytics.tsx). Headless CI may surface loader/beacon noise without implying a marketing page defect.",
  },
  {
    id: "vercel-web-analytics-network",
    kind: "requestfailed",
    pattern: /vitals\.vercel-insights\.com|_vercel\/insights/i,
    reason:
      "Same as vercel-web-analytics-script: optional analytics beacon on production marketing pages.",
  },
];

export function matchKnownTelemetryIgnore(text, kind) {
  return KNOWN_TELEMETRY_IGNORES.find(
    (entry) => entry.kind === kind && entry.pattern.test(text),
  );
}