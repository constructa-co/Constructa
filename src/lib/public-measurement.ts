/**
 * Typed public marketing measurement contract. Collection is disabled by default;
 * production callsites invoke dispatch only — no loader, beacon, collector, or persistence.
 * Enabling a collector requires a separately reviewed increment; this module does not forward events.
 */

/** When false, production dispatch is a no-op unless a test sink is injected. */
export const PUBLIC_MEASUREMENT_COLLECTION_ENABLED = false;

export const PUBLIC_MEASUREMENT_EVENT_NAMES = [
  "ContactFormSubmit",
  "TryConstructaClick",
  "WaitlistSubmitAttempt",
] as const;

export type PublicMeasurementEventName =
  (typeof PUBLIC_MEASUREMENT_EVENT_NAMES)[number];

const CTA_LOCATION_TOKENS = [
  "solution",
  "apart",
  "how-it-works",
  "about",
] as const;

export type PublicMeasurementCtaLocation =
  (typeof CTA_LOCATION_TOKENS)[number];

type PublicMeasurementProps = {
  TryConstructaClick: { location: PublicMeasurementCtaLocation };
  ContactFormSubmit: Record<string, never>;
  WaitlistSubmitAttempt: Record<string, never>;
};

/** Explicit public marketing routes only (fail closed elsewhere). */
const PUBLIC_ROUTE_EXACT = new Set([
  "/",
  "/landing",
  "/about",
  "/apply",
  "/contact",
  "/pricing",
  "/features",
  "/product",
  "/customers",
  "/privacy-policy",
  "/terms-of-service",
]);

const PUBLIC_ROUTE_PREFIXES = ["/guides"];

export type PublicMeasurementSink = (
  event: PublicMeasurementEventName,
  props: Record<string, string>,
) => void;

let testSink: PublicMeasurementSink | null = null;

/** Test-only: inject a sink to assert dispatch without contacting a collector. */
export function __setPublicMeasurementTestSink(
  sink: PublicMeasurementSink | null,
): void {
  testSink = sink;
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (withoutQuery === "/") return "/";
  return withoutQuery.replace(/\/+$/, "") || "/";
}

export function isPublicMeasurementRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (PUBLIC_ROUTE_EXACT.has(path)) return true;
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function sanitizeProps(
  event: PublicMeasurementEventName,
  raw: Record<string, string> | undefined,
): Record<string, string> {
  if (event === "TryConstructaClick") {
    const location = raw?.location;
    if (
      location &&
      (CTA_LOCATION_TOKENS as readonly string[]).includes(location)
    ) {
      return { location };
    }
    return {};
  }
  return {};
}

function resolvePathname(pathname?: string): string | null {
  if (typeof window !== "undefined") {
    return normalizePathname(window.location.pathname);
  }
  if (pathname) return normalizePathname(pathname);
  return null;
}

export function dispatchPublicMeasurementEvent<E extends PublicMeasurementEventName>(
  event: E,
  options?: {
    props?: PublicMeasurementProps[E] extends Record<string, never>
      ? undefined
      : Partial<PublicMeasurementProps[E]>;
    pathname?: string;
  },
): void {
  if (!(PUBLIC_MEASUREMENT_EVENT_NAMES as readonly string[]).includes(event)) {
    return;
  }

  const pathname = resolvePathname(options?.pathname);
  if (!pathname || !isPublicMeasurementRoute(pathname)) return;

  const props = sanitizeProps(
    event,
    options?.props as Record<string, string> | undefined,
  );

  if (event === "TryConstructaClick" && !props.location) {
    return;
  }

  if (testSink) {
    testSink(event, props);
  }
}

export function trackTryConstructaClick(
  location: string,
  pathname?: string,
): void {
  dispatchPublicMeasurementEvent("TryConstructaClick", {
    pathname,
    props: { location } as PublicMeasurementProps["TryConstructaClick"],
  });
}

export function trackContactFormSubmitAccepted(pathname?: string): void {
  dispatchPublicMeasurementEvent("ContactFormSubmit", { pathname });
}

export function trackWaitlistSubmitAttempt(pathname?: string): void {
  dispatchPublicMeasurementEvent("WaitlistSubmitAttempt", { pathname });
}
