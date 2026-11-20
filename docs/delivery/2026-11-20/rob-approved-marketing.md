# Rob-approved marketing / legal / pricing draft package

**Date:** 2026-11-20  
**Authority:** `CTO-20261120-1752-AUTHORITY.md` (item 2 legal, item 3 prices/testimonials)  
**Branch:** `codex/rob-approved-marketing-20261120`  
**Lane:** Source-only on this branch. No build, push, PR, merge, deploy, SQL, env apply, or publication sign-off in this session.

## Outcome

1. **PR #204 markdown reuse** — `docs/drafts/` copied from head `8fe2a1d` (`kimi/marketing-drafts-20261118`). Kimi authorship and Codex 19 Nov finishing pass preserved. Not merged; not publication.
2. **Legal draft source (not rendered/verified yet)** — `/privacy-policy` and `/terms-of-service` expanded using UK SaaS-style sections. Amber **Draft, not yet legally approved** banners retained. Entity, legal basis, processors, retention, liability and governing law remain `[ROB TO CONFIRM]` tokens via `src/lib/marketing/legal-entity-draft.ts`.
3. **Founding cohort pricing** — Full-profile `/pricing` and full home pricing block replaced with `FoundingCohortPricingPanel`: founding member discount label plus price tokens, no £20/£40/£80 tiers, no Paddle/trial claims. Cohort `/pricing` adds a short founding price section with the same tokens.
4. **Testimonials** — No testimonial sections added; CON-051 social-proof draft stays in `docs/drafts/` only (not wired to pages).
5. **Forms** — Public contact/apply collection remains **OFF** (unchanged from D64). Full home contact response-time line marked `[ROB TO CONFIRM]` instead of an unverified “1 working day” claim.

## Product files

| Area | Paths |
|------|--------|
| Legal tokens | `src/lib/marketing/legal-entity-draft.ts` |
| Pricing tokens | `src/lib/marketing/founding-cohort-pricing.ts` |
| Pricing UI | `src/components/marketing/founding-cohort-pricing-panel.tsx`, `full-pricing.tsx`, `full-home.tsx`, `phase-one.tsx` |
| Legal pages | `src/app/privacy-policy/page.tsx`, `src/app/terms-of-service/page.tsx` |
| Tests | `founding-cohort-pricing.test.ts`, `founding-cohort-pricing-panel.test.tsx`, `full-pricing-marketing.test.tsx`, updated `privacy-information.test.tsx`, `page.test.tsx` (terms) |
| PR #204 package | `docs/drafts/*` |

## Remaining verified facts and sign-off

- Company/entity: registered name/address, registration/VAT details if applicable; rendered legal wording still requires Rob sign-off before publication.
- Pricing: actual founding and standard price, currency/billing interval/discount amount if not verified in existing records.
- Shared inbox: whether hello@constructa.co exists and receives mail. Single inbox, Rob-only access and 12-month retention are already approved, not open questions.
- Testimonials are omitted as approved; no request for testimonial material blocks this package. Unknown response-time or provider claims remain draft placeholders; do not publish them as facts.

## Not done here (per authority)

- Publication of legal pages as final, live route promotion, or Rob sign-off on rendered HTML.
- Push, draft PR open, merge, deploy.
- CON-008 AI caps, CON-078 restore, schema #176/#185/#222–224 (separate steps).

## Evidence

Focused Vitest files listed above (not executed in this lane).