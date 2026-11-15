# Public marketing measurement (A097)

## Primary analytics choice

**Vercel Web Analytics** is the page-view collector (CTO 09:25 direction). Plausible remains only in the admin website tab; no Plausible loader is added to the public site. **GA4** is not justified by current requirements (no cross-product ad stack, no existing GA property). **Google Search Console** remains unconfigured: no ownership verification, API calls, or indexing claims in this increment.

## Scope and status

| Item | Meaning |
|------|---------|
| `src/lib/public-measurement.ts` | Shared typed event contract and route guard; dispatch is inert in production (test sink only in unit tests) |
| Marketing handlers | Wired to real UX boundaries on `/` and `/landing` only in this increment |
| Custom events | **Disabled** (`PUBLIC_MEASUREMENT_COLLECTION_ENABLED = false`). Handlers may call dispatch, but nothing is forwarded to a collector: no `track()`, forwarder, cookies or storage. Unchanged by the page-view work below. |
| Page views | Vercel Web Analytics via `@vercel/analytics`, mounted by `src/components/public-analytics.tsx` from the root layout. **Default-off (A097 D12):** nothing mounts unless `NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS=1` at build time. Vercel dashboard Web Analytics remains a separate, later step. |
| Newsletter signup (A101) | `src/components/marketing/newsletter-signup.tsx` on the phase-one home. **Default-off:** renders only when `CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED=1`, never in protected review or preview. The form posts the email address directly to the email provider (Kit/ConvertKit form 7919715). A submit is a subscribe request, not a confirmed subscription, and dispatches no measurement event. |

## Event definitions (truthful outcomes)

| Event | When it fires | What it does **not** mean |
|-------|----------------|---------------------------|
| `ContactFormSubmit` | Contact form HTTP response is OK after submit | Not fired on submit alone; not email delivery or CRM confirmation |
| `TryConstructaClick` | User clicks a labelled Try CONSTRUCTA CTA | Click / entry intent only; not signup or trial start |
| `WaitlistSubmitAttempt` | Waitlist form submit starts | Not confirmed newsletter subscription or ConvertKit success |

Unsupported unless an existing authorized path is wired later: account creation, estimate/proposal success, newsletter confirmation.

## Allowed properties

- `TryConstructaClick`: `location` ∈ `solution`, `apart`, `how-it-works`, `about` (from section tokens only).
- No email, free text, form payloads, project or account IDs, raw URLs, query strings, href, or referrer.

## Route guard

Dispatch and page views run only on explicit public marketing paths (`/`, `/landing`, `/about`, `/apply`, `/contact`, `/pricing`, `/features`, `/product`, `/customers`, `/privacy-policy`, `/terms-of-service`, `/guides/*`). Application, auth, admin, onboarding, proposal, supervisor, and unknown routes fail closed. In the browser, the guard uses the **current** `window.location.pathname` (call sites must not pin a stale marketing path after navigation).

`CONSTRUCTA_REVIEW_ONLY` is checked in the root layout: in protected review the analytics component is not rendered at all, so no loader or beacon exists there. Custom-event dispatch still has no browser review gate, but it forwards nothing.

## Vercel Web Analytics page views

Five independent layers; any one of them stops a page view:

0. **Activation:** `isPublicPageviewMeasurementEnabled()` is false unless `NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS=1` at build time. Unset on every existing deployment → no collector script, no beacons.
1. **Server:** root layout omits `<PublicAnalytics />` when `CONSTRUCTA_REVIEW_ONLY === '1'`.
2. **Mount:** the client component renders nothing until after hydration, nothing off `isPublicMeasurementRoute(usePathname())`, and nothing while a Supabase session cookie (`sb-*-auth-token`) is present. It re-evaluates on every route change, so client navigation into the app unmounts it. Only the cookie *name* is inspected.
3. **Send time:** `beforeSend` (`filterPageviewEvent`) re-checks the cookie and route, then rewrites the URL to origin + path. Query string, fragment and credentials are dropped, so campaign parameters, emails and tokens never leave the browser.
4. **Hosted:** Vercel Web Analytics must be enabled for the project in the Vercel dashboard; until then the script URL does not exist and nothing is collected.

Not collected by Constructa code: custom events, cookies, local/session storage, user or account identifiers. Vercel records referrer, country, device and browser itself; that cannot be stripped client-side.

Consequence: visitors with a session cookie are not counted on public pages, and UTM parameters are not recorded (the query string is removed). Adding a fixed allow-list of `utm_*` keys is a separate decision.

## Admin metrics honesty

Admin website/growth views may show **calendar-month signups ÷ rolling 30-day Plausible visitors**. That ratio is **not session-attributed conversion** and must not be labelled as proof that visitors converted in Plausible.
