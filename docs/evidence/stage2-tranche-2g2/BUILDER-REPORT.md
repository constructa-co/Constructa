# Stage 2G.2 builder report: authorised own-company website import

- Issue: https://github.com/constructa-co/Constructa/issues/90 (slice 2G.2)
- Base: `codex/stage2g1-integration` at `d8850248073ab383c22c36a0b569b1d7e25ff6fc` (PR 91, not merged)
- Branch: `claude/stage2-tranche-2g2-import`, in its own worktree `constructa-stage2-tranche-2g2`
- Implementation commit: `53c4e76ba8e84eae22fe4a9a769775da89613719`. This report is the commit after it.
- Patch (both commits): `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g2-import.patch`
- Built: 7 October 2026. Local only: not pushed, no PR, nothing deployed, no hosted database touched.

## What the contractor gets

From Profile, "Bring in details from your website" opens
`/dashboard/settings/profile/import`.

1. They type their website address and tick a box confirming it is their
   own business's website and that Constructa may read it. The box is never
   ticked for them. Without it nothing is looked up or fetched.
2. They see what was found, grouped as company identity, services and
   contact details. Each item shows the saved value beside the found value,
   the piece of the page it came from, the page address, and when the
   website was read. Items that clients see on proposals say so.
3. Nothing is ticked. They tick the changes they want and press save. Only
   those fields change.
4. If a saved value changed after the preview (edited by hand, another
   tab), that item is not saved. It shows the newer value and asks again.
5. If the website cannot be read, or a save fails, a plain message appears,
   what they typed and ticked is kept, the button reads "Try again", and
   "Enter details by hand" goes to the existing Profile form.

## Survey findings that shaped the design

- **Profile save has no per-field validation.** `updateProfileAction` is one
  whole-form upsert. The import therefore carries its own field list and
  limits and writes one column at a time.
- **Published snapshots read `profiles` directly**
  (`PROFILE_PUBLICATION_COLUMNS` in the proposal actions). Of the fields the
  import can suggest, `company_name`, `phone`, `website` and `specialisms`
  are published; `sales_email`, `address`, `company_number` and `vat_number`
  are profile-only. Keeping suggestions out of `profiles` is what keeps them
  out of proposals.
- **There was no safe outbound fetch utility** and no HTML parser in the
  dependencies. `safeImageUrl` and `requireTrustedAppUrl` validate strings
  only; neither fetches.

## Design

### Fetch guard (`src/lib/company-import/net-policy.ts`, `safe-fetch.ts`, `robots.ts`)

No new dependency: Node's `http`, `https` and `dns`.

| Rule | How |
| --- | --- |
| Public web only | `http:` or `https:`, standard port only, no user name or password, a real domain name. Numeric addresses in any spelling, single-label names, `localhost` and internal suffixes (`.local`, `.internal`, `.lan`, `.test`, `.home.arpa` and others) are refused before any lookup |
| DNS | Every address a name resolves to must be public. One private answer among public ones refuses the whole name. IPv4 special ranges (private, loopback, link-local and metadata, CGNAT, documentation, benchmarking, multicast, reserved) and IPv6 outside global unicast, plus mapped, NAT64, 6to4, Teredo, ORCHID and documentation ranges, are refused. Anything that does not parse as an address is refused |
| Rebinding | The connection is made to the checked address through the socket's `lookup` hook, with no connection pooling, and the connected peer address is compared again. The name is re-resolved and re-checked for every request |
| Redirects | Never followed by the HTTP client. Each `Location` goes through the same URL, DNS and pin steps and must stay on the approved website (the confirmed name, with or without `www.`). Subdomains, other names and https-to-http are refused |
| Limits | 4 pages, 512 KB per response, 3 redirects per page, 8 s per request, 20 s overall. Compressed bodies are not requested and are refused if sent |
| robots.txt | Read first through the same guard. A disallowed first page stops the import; disallowed further pages are skipped. No file (4xx) means allowed; 429 or 5xx stops the import |
| Abuse | 6 previews per contractor per hour, counted from saved drafts. If the count cannot be read, nothing is fetched |
| Messages | The contractor is told what to do next. Technical detail and addresses are never echoed back |

### Extraction (`extract.ts`)

Deterministic pattern matching only. No model, no AI call, no provider
cost. Page content is searched, never executed or obeyed:

- business name from structured data or the site-name tag (not from the
  page title);
- phone and email from structured data or `tel:` / `mailto:` links (not
  from prose);
- address from structured data or a postal-looking `<address>` block;
- services from structured data, or from headings on a services page;
- company number and VAT number from explicitly labelled text;
- website from the address the contractor confirmed.

At most one suggestion per field, strongest evidence first. Values are
reduced to single-line plain text with tags, control characters and stray
angle brackets removed, and capped per field. Where a pattern is not
clearly present, no suggestion is made.

### Draft and approval (`draft.ts`, `service.ts`, migration)

- New table `public.company_import_drafts`: owner, source address, website,
  permission time, fetch time, pages read, and the items (proposed value,
  saved value shown, source page, excerpt, basis, status, approval time).
- Row level security limits every operation to `user_id = auth.uid()`. No
  access for signed-out visitors. A trigger fixes the source, website,
  permission time, fetch time, pages and owner once a draft exists; only
  item state changes.
- **Preview** inserts a draft and nothing else.
- **Approval** sends only `{ field, expectedExisting }` per ticked item.
  The value written comes from the saved draft, not from the browser. The
  update is conditional on the profile column still equalling
  `expectedExisting` (`NULL` and empty string are distinct). No row updated
  means a conflict: nothing is written and the current value is returned.
- Server actions call `requireLaunchCapability("company-profile")` and
  `requireAuth()`, and every query also names the signed-in contractor.
- The page reloads the latest draft compared with the profile as it is now,
  so a review can be left and resumed.

Why a table rather than holding the preview in the browser: issue 90 asks
for source, extraction time and approval state to be recorded, and a
server-held draft is what lets approval ignore any value the browser sends.

## Files

| File | Purpose |
| --- | --- |
| `src/lib/company-import/net-policy.ts` | URL, address and website-boundary rules; limits |
| `src/lib/company-import/safe-fetch.ts` | Pinned request and bounded crawl |
| `src/lib/company-import/robots.ts` | robots.txt matching |
| `src/lib/company-import/extract.ts` | Deterministic extraction |
| `src/lib/company-import/draft.ts` | Field list, item model, input schemas, messages |
| `src/lib/company-import/service.ts` | Preview, resume and approval |
| `src/app/dashboard/settings/profile/import/{page,import-client,actions}.tsx/.ts` | Screen and server actions |
| `src/app/dashboard/settings/profile/page.tsx` | Entry link |
| `supabase/migrations/20261007120000_company_import_drafts.sql` | Drafts table, RLS, grants, guard trigger |
| `scripts/test-company-import-sql.sh`, `package.json`, `.github/workflows/ci.yml` | Migration replay and isolation test, wired into CI |
| `*.test.ts`, `src/lib/company-import/__fixtures__/` | 78 unit tests and their fixtures |

Not touched: `src/app/(marketing)/`, the proposal publication code, the
onboarding and readiness code from 2G.1, `launch-profile.ts`, `proxy.ts`
(the route sits under the already-allowed Profile prefix), and any existing
migration.

## Test results

All on the final code, 7 October 2026.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 56 files; 915 passed, 4 skipped, 0 failed (837 passed at base) |
| New tests alone | 7 files, 78 passed |
| `npx eslint .` | 0 errors |
| `npx next build` | Pass; `/dashboard/settings/profile/import` in the route list |
| `npm run test:company-import-sql` | Pass, on a throwaway local PostgreSQL 14 |
| Browser fixture run | 3 passed: desktop 1280x800, phone 390x844 (touch), desktop keyboard-only |

Required coverage and where it is proved:

| Requirement | Proof |
| --- | --- |
| Permission | `service.test.ts`: any value but `true` makes no lookup, no request, no write. Browser: permission alert, zero previews |
| Preview has no mutation | `service.test.ts`: profiles byte-identical; the only write is the draft insert. Browser: profile read back unchanged |
| Selective approval | `service.test.ts`: two fields approved, writes are exactly `phone` and `website`. Browser: two of eight |
| Value cannot be supplied by the browser | `service.test.ts`: extra `proposed` ignored; fields outside the list (`bank_details`, `logo_url`, `capability_statement`, `case_studies`, `id`, ...) refused with no write |
| Conflict and stale value | `service.test.ts` and browser: newer value kept, shown, re-approval works; `NULL` versus empty string |
| Retry and input retention | `service.test.ts`: fetch, draft-save and profile-save failures each change nothing and succeed on retry. Browser: address, permission and ticks kept |
| Tenant isolation | SQL test: second contractor sees, changes, deletes and hijacks nothing; signed-out visitor refused; owner and source immutable. `service.test.ts`: another contractor's draft id returns "no longer available" with no write |
| Hostile URL, DNS, redirect | `net-policy.test.ts`, `safe-fetch.test.ts`: credentials, schemes, ports, numeric and encoded addresses, internal names, private and mixed DNS answers, rebinding part-way, redirects to other hosts, internal addresses, subdomains, private-resolving names, downgrade, loops |
| Size, time, page limits | `safe-fetch.test.ts`: page cap with 60 links; byte cap declared and streamed, time limit, no auto-redirect, no compressed body, all on a real socket against a loopback fixture server |
| Pinning | `safe-fetch.test.ts`: a name that does not exist connects only because of the pin, and the Host header still carries the name |
| Unavailable source, manual fallback | `service.test.ts`, browser |
| Untrusted content | `extract.test.ts`: injected instructions, script payloads, hostile structured data and markup produce plain text or nothing. `import-client.test.ts`: hostile values render escaped; the screen's only links are the app's own |
| Unapproved content excluded from immutable proposals | `service.test.ts`: a snapshot built by the real `buildProposalPublicationSnapshot` after a preview contains no proposed value; after approving one field it contains that one only |

Browser run details: layout (no sideways scroll, nothing past the viewport,
controls at least 44x44 px, nothing obscured on touch) and an axe WCAG 2.2
A/AA scan at seven checkpoints, zero findings on all three projects. The
keyboard run reached 12 controls, all with visible focus. Results are in
`results-desktop.json`, `results-phone.json` and
`results-desktop-keyboard.json`.

## Screenshots

Each has a `-1280x800.jpg` and a `-390x844.jpg` version in this folder.
All data is synthetic ("Smith Builders", `smithbuilders.co.uk`); no website
was contacted.

| File | Shows |
| --- | --- |
| `01-import-start` | Address field, permission unticked, manual entry link |
| `02-import-website-unavailable` | Website down: message, input kept, "Try again" |
| `03-import-preview` | Suggestions after retry, nothing ticked |
| `04-import-preview-item` | One item: saved value, found value, excerpt, source |
| `05-import-stale-value-not-overwritten` | Phone changed elsewhere: not saved, newer value shown |
| `06-import-selected-saved` | Two approved items saved, six left untouched |

## How the browser run was done, and its limits

The new table does not exist in the disposable E2E project, and applying a
migration to a hosted project was outside this brief. So the browser run
used a temporary route that mounted the real screen with server actions
calling the real `previewImport` and `applyImport` against an in-memory
database and a fixture website, on a production build with no Supabase
configuration. The route, its actions, the Playwright config and the spec
were deleted before commit, as in tranche 2B. That means:

- the real crawl, extraction, draft and approval code ran behind the real
  screen and real server actions;
- the dashboard shell, sign-in, `requireAuth`, real RLS and the real
  `/dashboard/settings/profile/import` page loader were **not** exercised in
  a browser. They are covered by unit tests and the SQL test only;
- the run cannot be repeated from this commit without recreating the
  harness.

## Blockers and decisions for the integrator

1. **The migration must be applied to the disposable project before any
   hosted E2E of this slice.** Until then the page loads with no draft and a
   preview ends in the generic "couldn't read that website" message, because
   the recent-use count fails closed. Nothing else in the app depends on the
   table.
2. **Full-chain migration replay was not run locally.** The single
   migration replays on a clean local Postgres. The repository's replay job
   uses the pinned `supabase/postgres` image in CI; the new file sorts last
   and depends only on `auth.users` and `auth.uid()`.
3. **No E2E spec was added for this slice**, for reason 1. One should be
   written once the table exists there, with the website stubbed.
4. **The real network path has not made a live request.** By instruction
   everything was mocked. The pinned transport was exercised on a real
   loopback socket, over `http` only; `https` to a real host (certificate
   and SNI under the pin) is unproved.

## Risks

- **Hosting egress.** The guard assumes the server resolves and connects
  directly. Behind an outbound proxy the pin would apply to the proxy, not
  the website; the peer-address check would then refuse every request.
- **IPv6-only or dual-stack websites.** The first DNS answer is used. If
  the host cannot reach that family the import reports the website as
  unavailable; there is no fallback to the next answer.
- **Websites that need JavaScript, cookies or compression** will yield few
  or no suggestions. The screen says so and offers manual entry.
- **Markup is matched with patterns, not parsed.** Unusual markup can hide a
  fact or, less likely, mislabel one. Every suggestion shows its excerpt and
  needs approval.
- **Rate limit counts saved drafts.** Failed fetches are not counted, so a
  contractor can repeat failing requests. Each is still bounded to one
  website, 4 pages and 20 seconds.
- **`sameValue` ignores case and spacing** when deciding an item already
  matches. A contractor wanting only a capitalisation change must make it
  by hand.
- **Drafts are kept indefinitely.** No clean-up job was added. A draft
  holds short excerpts of the contractor's own public website.
- **Approval is one statement per field, not one transaction.** If
  recording the approval on the draft fails after the profile was written,
  the item shows as pending and resolves to "already matches" on reload.
- **Subdomains are outside the approved website.** A contractor whose
  contact page is on a subdomain gets nothing from it.

## Deferred

Logos and photos, case-study drafts, AI interview and narrative, competitor
research, terms, structured address fields, a readiness-page entry point,
draft retention, and a hosted E2E spec.
