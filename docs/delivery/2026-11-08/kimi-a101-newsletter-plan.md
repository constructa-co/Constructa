# A101 — Newsletter sign-up plan (batch 4)

**Status: DRAFT - ROB REVIEW REQUIRED. Later-release consent/provider design only — no emails, no forms, no imports, no DNS, no provider activation, no SQL, no settings change.**
Author: Kimi, 2026-11-08 (batch 4), branch `kimi/marketing-drafts-20261108-1020`.

This is the batch-4 companion to the batch-2 design draft `kimi-a101-newsletter-design.md`, which remains the detailed reference (source inventory, consent model, double opt-in, suppression logic, failure-mode table, acceptance tests). This plan adds: (a) a UK regulatory grounding pass with dated sources, (b) a phased implementation outline for a later release, and (c) the open decisions Rob must make. Nothing here has been implemented.

## 1. Regulatory grounding (retrieved 2026-11-08, secondary sources — not legal advice)

- **Consent for individuals; corporate-subscriber exception.** Under PECR reg. 22, marketing email/text to *individual subscribers* requires prior consent unless the soft opt-in applies; the ICO's guidance as summarised by practitioners confirms the consent rule does not apply to *corporate subscribers* (limited companies, LLPs, Scottish partnerships, government bodies) — but every message must still identify the sender and offer a working opt-out, and sole traders/partnerships count as individuals ([NewcoHunter PECR summary, 2026-10-02](https://www.newcohunter.co.uk/help/outreach-and-compliance/pecr-email-rules); [Ripe Leads, 2026-09-26](https://ripeleads.eu/resources/cold-email-legal-uk); [PeekWell PECR explainer, 2026-10-10](https://peekwell.org/wiki/uk/marketing-signups-and-opt-out/)). *Secondary-law-firm/blog sources; the ICO's own Guide to PECR was not fetched line-by-line this pass — flag for Rob's legal check.*
- **Soft opt-in exists but should not be relied on at launch.** It permits marketing to existing customers for similar products where they were given an opt-out at collection. A brand-new newsletter list has no existing-customer base to lean on, so **confirmed opt-in remains the plan** regardless.
- **Penalties increased.** From 5 February 2026, PECR penalties are significantly raised under the Data (Use and Access) Act 2025, with ICO enforcement priorities including marketing without valid consent and broken unsubscribe mechanisms ([Guvnor compliance summary, 2026-09-27](https://guvnor.ai/guidance/email-marketing-compliance/)). *Unverified against the statute text; reinforces that consent evidence and suppression must be airtight before any send.*
- **Record-keeping duty.** UK GDPR accountability means being able to demonstrate compliance on request: source of each contact, classification (individual vs corporate), lawful basis, consent artefact ([Global Law Experts, 2026-09-25](https://globallawexperts.com/news/b2b-email-marketing-rules-uk)). This matches the consent-artefact design already in the batch-2 draft.

## 2. Phased plan (all phases gated on Rob; none started)

| Phase | Content | Exit gate |
| --- | --- | --- |
| 0 — Decision | Rob picks provider (Kit recommended; Resend-segmented fallback), confirms newsletter purpose/copy tone, legal review of consent label & privacy notice | Rob sign-off on this plan |
| 1 — Schema only | A reviewed migration adding a newsletter-consent table (user/email-hash, consent timestamp, copy-version id, source page, confirmed-at, suppressed-at). No form, no send path | Migration review; no activation |
| 2 — Form surface | Unchecked-by-default checkbox on the signup surface (separate from platform terms), posting to the new table only; no provider calls yet | Focused tests: §8 of the batch-2 design draft |
| 3 — Provider wiring | Double opt-in via provider API; confirmation email; confirmed-only send segment; service mail untouched | Rob-created provider account (by him, no agent credentials); test send to Rob only |
| 4 — First campaign | One issue, small confirmed list, plain links, unsubscribe prominent | Rob reviews content; suppression audit passes |

## 3. Open decisions for Rob

1. Provider: Kit vs Resend-with-hard-segmentation vs equivalent (trade-offs in batch-2 draft §6).
2. Scope of list: strictly opt-in subscribers only (plan as written) vs any future corporate-subscriber outreach (would need its own lawful-basis review — **not recommended** for this list).
3. Whether A101 stays coupled with the A103 content pilot (newsletter as distribution for guide content) or proceeds standalone. Coupling is recommended but either is valid.
4. Who owns the human legal review (solicitor or Rob's own review) before Phase 3.

## 4. Non-goals (reaffirmed)

No list import of any existing contacts; no scraping; no purchased lists; no tracking pixels beyond the provider's default (Rob may disable); no merge with platform-terms acceptance; no DNS work by agents.

## 5. Status

A101 remains **Not started** — plan only; no form, provider account, email, import, or activation performed or implied. No register/dashboard mutation.
