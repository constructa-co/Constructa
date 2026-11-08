# A022 — Importing a contractor's website and social profiles (feasibility review, draft)

**Status: DRAFT — ROB REVIEW REQUIRED. Review only: no scraping performed, no account connection, no API keys read, no SQL, no code changes.**
Author: Kimi, 2026-11-08, branch `kimi/marketing-drafts-20261108-1020`. All codebase findings are from offline source inspection of this branch; the two robots.txt observations are from read-only `curl` fetches on 2026-11-08.

## 1. What already exists (website import)

A website import feature already ships on this branch at `/dashboard/settings/profile/import`, built in `src/lib/company-import/`:

- `net-policy.ts` — pure allow/deny rules: public addresses only (full IPv4 special-range blocklist, global-unicast IPv6 minus tunnels), no IP literals, no non-standard ports, no credentials in URLs, host must stay within the approved website (`isWithinWebsite`), hard caps (4 pages, 10 requests, 512 KiB per response, 3 redirects, 8 s per request, 20 s total).
- `robots.ts` + `safe-fetch.ts` — robots.txt is fetched and honoured; failure codes include `robots-disallowed` and `robots-unavailable`.
- `extract.ts` — **deterministic** pattern matching only: fields are `company_name`, `website`, `company_number`, `vat_number`, `specialisms`, `phone`, `sales_email`, `address`, with per-field max lengths, source URL, a plain-text excerpt, and a `basis` tag (`structured-data`, `contact-link`, `page-text`, `page-heading`, `confirmed-address`). Nothing from a fetched page is executed or sent to a model.
- `draft.ts` / `actions.ts` — suggestions land in an expiring draft; the contractor reviews each ticked suggestion before anything is saved. Nothing is written without approval; previews older than a day are refused (`IMPORT_EXPIRED_ERROR`).

This is a strong, conservative baseline. The register marks A022 "Partial", consistent with the website half being built.

## 2. Website import — what could be read

What a typical contractor company site exposes to this pipeline:

- **High confidence:** name, tagline/specialisms, phone, sales email, postal address, VAT and company numbers (from JSON-LD `LocalBusiness`/`Organization` structured data or visible contact-page text).
- **Medium confidence:** service lists, coverage area, founding year — pattern-dependent; extract only emits a suggestion when a pattern matches clearly.
- **Not readable by design:** anything behind a form or login, images as content (text pipeline only), JS-rendered pages whose facts never appear in raw HTML, sites that block bots.

Failure surface is already enumerated in code: `invalid-url`, `unsafe-address`, `outside-website`, `too-many-redirects`, `request-limit`, `too-large`, `timeout`, `not-html`, `robots-disallowed`, `robots-unavailable`, `unavailable`, plus draft-state errors (`expired`, `gone`, `rate`, `in-flight`).

## 3. LinkedIn / Facebook — feasibility verdict

**Verdict: not feasible to auto-import within the project's current rules, and the sites' own terms point the same way.**

Evidence gathered 2026-11-08 (read-only `curl` of each site's public robots.txt):

- **LinkedIn** (`https://www.linkedin.com/robots.txt`): banner states "The use of robots or other automated means to access LinkedIn without the express permission of LinkedIn is strictly prohibited", with crawling only by permission/whitelist. Most substantive profile and company-page paths are `Disallow`ed for general agents; logged-out visitors are typically bounced to an auth wall.
- **Facebook** (`https://www.facebook.com/robots.txt`): banner states "Collection of data on Facebook through automated means is prohibited unless you have express written permission from Facebook". Business-page HTML is login-walled for practical purposes.

Consequences for this codebase:

1. **The existing robots gate would refuse these hosts anyway** — the correct behaviour under the current policy is `robots-disallowed`, i.e. "enter details by hand", which is honest but a dead end as a feature.
2. **Circumventing that (headless browser, logged-out scraping, third-party scraper APIs) is off the table**: it breaches the sites' stated terms, creates account/legal exposure for Constructa, and conflicts with the project's "when a rule cannot prove an address is public, the answer is no" posture.
3. **Official APIs** (LinkedIn profile/organization endpoints, Meta Graph API for Pages) all require an app review/approval process and **the contractor's or Constructa's own authenticated account connection** — that is an account-linking feature, a different scope with its own consent, revocation and data-handling design. Not assessed further here; no account was connected.

## 4. Recommended shape (for Rob's decision)

| Option | What it means | Fit |
| --- | --- | --- |
| **A. Keep website import; social = manual paste** | Add an optional "paste your public LinkedIn/Facebook About text" field on the profile page; the same deterministic suggestion/review flow proposes fields; nothing is fetched from LinkedIn/Facebook at all. | **Recommended.** No robots/ToS exposure, no account connection, reuses the draft-consent UX. Paste is bounded (e.g. 4 000 chars), never executed, treated as untrusted text exactly like fetched pages. |
| B. Defer social entirely | Register A022 completes with website import alone; social stays out until/unless official API access is approved and an account-linking design exists. | Cleanest legally; least user value. |
| C. Third-party enrichment API | Pay a data broker for company social data. | **Not recommended here:** provenance and licence questions, and it undermines the "contractor's own words, reviewed before save" consent model. |

## 5. Consent and data handling (applies to website import today, and to option A)

- The contractor **types their own URL / pastes their own text** — self-authorisation is the consent act; there is no third-party personal data involved (business contact details only).
- Human-in-the-loop is absolute: every suggestion shows its source URL and excerpt; unticked = never saved.
- Drafts expire (>1 day) and are never applied silently; rate limiting (per-hour cap) is already enforced.
- Nothing fetched is executed, stored raw, or passed to a model (per `extract.ts` header comment).
- If option A adds paste: same field caps, same excerpt display, no fetching, no persistence of the pasted blob beyond the approved fields.

## 6. Acceptance tests (offline, against option A design)

1. Paste box accepts plain text, strips markup/control characters (`plainText()` behaviour), enforces a max length, and submits nothing until "Get suggestions" is pressed.
2. Suggestions from pasted text carry `basis: "page-text"`-equivalent and **no source URL** (labelled "from your pasted text"), distinct from website suggestions.
3. Saving only persists ticked fields; the raw paste is discarded after the draft is saved or expires.
4. Draft expiry/rate-limit/in-flight errors reuse the existing `IMPORT_*` messages.
5. The import page never issues a network request to `linkedin.com` or `facebook.com` — asserted in a component test (existing tests already assert "Opening this page does not fetch your site").
6. Regression: existing `src/lib/company-import/` suite stays green (137 tests pass on this branch as of 2026-11-08: 99 company-import + 38 proposal-brochure).

## 7. Evidence and limits

- Verified: `src/lib/company-import/` source and tests (99 passed, run from this worktree with the live repo's vitest, 2026-11-08).
- Verified: both robots.txt banners via read-only `curl` on 2026-11-08. LinkedIn's per-path Allow/Disallow matrix and Facebook's were only skimmed (first ~30–40 lines), not exhaustively parsed — marked **unverified in detail**.
- Not verified: current LinkedIn/Meta API approval requirements (public knowledge only; changes over time); logged-out rendering behaviour of specific business pages; any legal conclusion — **Rob's legal review required** before any social-profile feature ships.
- Not done: no scraping, no account connection, no API calls, no code changes.
