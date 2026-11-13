/**
 * Typed public marketing measurement contract. Custom-event collection is disabled;
 * callsites invoke dispatch only and this module does not forward events.
 * Page views are the one exception: `<PublicAnalytics>` mounts Vercel Web Analytics
 * on explicit public routes only, filtered by `filterPageviewEvent` below.
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

/**
 * Vercel Web Analytics page views (A097). Separate from the custom-event flag
 * above: this only lets `<Analytics>` count page views on explicit public
 * routes. Custom events stay inert. Set to false to remove all page-view
 * collection without touching any other code.
 */
export const PUBLIC_PAGEVIEW_MEASUREMENT_ENABLED = true;

/**
 * True when a browser cookie header carries a Supabase session cookie
 * (`sb-<ref>-auth-token`, optionally chunked as `.0`, `.1`...). Only the cookie
 * name is inspected; the value is never read, kept or sent anywhere.
 */
export function hasSignedInSessionCookie(cookieHeader: string): boolean {
  return /(?:^|;\s*)sb-[^=;\s]+-auth-token(?:\.\d+)?=/.test(cookieHeader);
}

/**
 * Reduce a page-view URL to origin + pathname, or null if it must not be sent.
 * Drops query string, fragment and credentials, and fails closed for any path
 * outside the explicit public marketing routes.
 */
export function sanitizePageviewUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!isPublicMeasurementRoute(url.pathname)) return null;
  return `${url.origin}${url.pathname}`;
}

/**
 * `beforeSend` for `<Analytics>`: last line of defence at send time. Returning
 * null cancels the event. Pass `document.cookie` so a sign-in that happened
 * after mount is still honoured.
 */
export function filterPageviewEvent<T extends { url: string }>(
  event: T,
  cookieHeader: string,
): T | null {
  if (!PUBLIC_PAGEVIEW_MEASUREMENT_ENABLED) return null;
  if (hasSignedInSessionCookie(cookieHeader)) return null;
  const url = sanitizePageviewUrl(event.url);
  return url ? { ...event, url } : null;
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
