# Public marketing measurement (A097)

## Primary analytics choice

Reuse **Plausible** as the first collector when collection is explicitly enabled later. It already fits Constructa's privacy posture and admin API wiring. **GA4** is not justified by current requirements (no cross-product ad stack, no existing GA property). **Google Search Console** remains unconfigured: no ownership verification, API calls, or indexing claims in this increment.

## Scope and status

| Item | Meaning |
|------|---------|
| `src/lib/public-measurement.ts` | Shared typed event contract, route guard, review exclusion, optional Plausible forwarder |
| Marketing handlers | Wired to real UX boundaries on `/` and `/landing` only in this increment |
| Collection | **Disabled by default** (`PUBLIC_MEASUREMENT_COLLECTION_ENABLED = false`). No script loader, SDK, beacon, env activation, cookies, or storage. **Partial** until a separate release enables collection and proves deployed events. |

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

Dispatch runs only on explicit public marketing paths (`/`, `/landing`, `/about`, `/contact`, `/pricing`, `/features`, `/product`, `/customers`, `/privacy-policy`, `/terms-of-service`, `/guides/*`). Application, auth, admin, onboarding, proposal, supervisor, and unknown routes fail closed.

Review deployments (`CONSTRUCTA_REVIEW_ONLY=1`) do not dispatch.

## Admin metrics honesty

Admin website/growth views may show **calendar-month signups ÷ rolling 30-day Plausible visitors**. That ratio is **not session-attributed conversion** and must not be labelled as proof that visitors converted in Plausible.
