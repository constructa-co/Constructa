# Marketing copy drafts — private review collection

**Status of everything in this folder: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED · NOT SCHEDULED**
**Author:** Kimi, 18 November 2026, branch `kimi/marketing-drafts-20261118` (Constructa CTO 00:26 batch, item 4, due 08:00)
**Packaging:** files only, staged for Codex review and draft-PR packaging. No commit, push, PR, build, deploy or publication by Kimi.

## What this folder is

Draft copy for the marketing-site items of the 85-item snag tracker (`docs/snags/grok-20261115-tracker.md`, head `b1e0618`, 53 merged / 20 in progress / 12 Rob-gated) that are still open **because an approved owner input is missing**. Nothing here is wired into `src/`. Nothing here may ship as-is.

## Placeholder convention

`[OWNER INPUT: ...]` marks every fact that must come from Rob before publication: testimonials, pricing, legal identity, contact/application destinations, retention and handling statements. A draft containing any `[OWNER INPUT]` token must never be published, sent, scheduled or merged into a page without the input being supplied and the draft re-marked approved by a human reviewer. Drafts deliberately invent **no** testimonials, **no** prices, **no** legal identity and **no** destinations.

## Index

| File | Tracker item | Drafts | Blocked on |
| --- | --- | --- | --- |
| `con-051-home-social-proof-and-pricing.md` | CON-051 (Rob-gated) | Home social-proof section, Home pricing teaser | Approved testimonials; confirmed pricing |
| `con-052-legal-entity-website.md` | CON-052 (Rob-gated) | Footer legal line, About company paragraph | Legal entity name, registration, address |
| `con-053-contact-page-destination.md` | CON-053 (Rob-gated) | Contact page expansion, form intro copy | Contact destination and data handling; response-time commitment |
| `con-039-proposal-domestic-terms.md` | CON-039 (Rob-gated) | Review-screen notice wording; clause-wording skeletons | Approved domestic/commercial terms wording (legal review) |
| `con-009-privacy-policy-completion.md` | CON-009 (Rob-gated) | Expanded privacy policy draft | Entity identity, legal basis, retention, processors |
| `con-010-platform-terms-expansion.md` | CON-010 (Rob-gated) | Expanded platform terms draft | Entity identity, jurisdiction, liability position |
| `con-013-apply-destination-and-handling.md` | CON-013 (Rob-gated) | Apply form storage-notice copy variants | Application destination and data handling |
| `missing-inputs.md` | — | Plain record of every awaited input | Rob |

## Boundaries (from approved site copy and the 14 Nov delivery)

- Phase-one framing stands: this is a **review for existing review accounts**; the only public access route is applying to the founding cohort; the preview takes no payment and does not sell a subscription. Drafts must not contradict `src/components/marketing/phase-one.tsx`.
- Held back — do not imply available: live AI chat assistance, payments/checkout, general sign-up, live customer jobs.
- No invented testimonials, adoption stats, savings figures, price quotes, security certification or launch dates. The only date in approved copy is "Founding cohort opens 7 December 2026".
- Canonical links only: `https://www.constructa.co/`, `/features`, `/pricing`, `/apply` — no UTMs, short links or new paths.
