# Missing inputs — plain record

**Status: PRIVATE REVIEW RECORD · NOT APPROVED · NOT PUBLISHED**
Companion to the drafts in this folder. Every input below is required before the linked draft can be approved or published. This file invents nothing and approves nothing.

| # | Input needed | From | Blocks | Notes |
| --- | --- | --- | --- | --- |
| 1 | Approved testimonials (real reviewer name or initials, role, words, permission to quote) | Rob | CON-051 social-proof section | No testimonial exists in any approved source. Draft uses placeholder slots only. |
| 2 | Confirmed pricing (plan names, prices, billing periods, project/team limits, support levels) | Rob | CON-051 pricing teaser; any Home pricing reference | `src/components/marketing/full-pricing.tsx` currently shows £20/£40/£80 monthly with "24/7 priority support"; tracker note on #191 says pricing needs approved owner inputs, so those numbers are treated as unconfirmed. |
| 3 | Response-time commitment for contact ("Within 1 working day" currently appears on the Home contact section) | Rob | CON-053 contact copy | Either confirm the commitment or approve softer wording in this folder's draft. |
| 4 | Contact form destination (where a submitted message goes, who reads it, how it is handled and kept) | Rob | CON-053 contact form copy | Contact page is mailto-only today; the page itself states no form exists. Any form copy must state a true destination. |
| 5 | Legal entity name | Rob | CON-052 footer/About; CON-009 privacy; CON-010 terms | No legal identity appears anywhere in approved copy. |
| 6 | Company registration number and registered office address | Rob | CON-052 footer/About | Placeholder only in drafts. |
| 7 | VAT registration number (if registered) | Rob | CON-052 footer (optional line) | Optional; omitted if not registered. |
| 8 | Approved domestic proposal terms wording (or confirmation that `phase1-standard-v1` stays the only default for the January cohort) | Rob, with qualified UK construction-law review | CON-039 | D51 documented the gap from source (`docs/delivery/2026-11-16/d51-terms-gap.md` on the Claude delivery branch); no clause wording changed. Draft provides notice wording and skeletons only. |
| 9 | Approved commercial-client wording for proposal clauses 3 (Adjudication) and 9 (CDM), if commercial clients are in scope | Rob, with legal review | CON-039 | Current standard clauses state the client is a homeowner. |
| 10 | Whether to add Termination / Final Account / Retention clauses to the standard set | Rob, with legal review | CON-039 | Named in the Contracts-tab domestic list but absent from standard proposal terms. |
| 11 | Privacy policy specifics: data-controller identity, legal bases, retention periods, processor list (hosting, email provider, analytics), international transfer position | Rob | CON-009 | Current policy page itself states it is incomplete and not legally approved. |
| 12 | Platform terms specifics: contracting entity, governing law/jurisdiction, liability position, subscription/payment terms for when pricing is real | Rob, with legal review | CON-010 | Current terms are five short sections; expansion must not invent an entity. |
| 13 | Application destination and data handling for the founding-cohort apply form | Rob | CON-013 | Form exists but cannot be submitted; any storage-notice copy must describe a real destination. |
| 14 | Decision: keep or remove the ConvertKit (Kit) updates form reference, and the newsletter destination account, before privacy copy references them as current | Rob | CON-009; `newsletter-signup.tsx` copy | Privacy page currently names Kit (ConvertKit) form 7919715; confirm it is still the intended provider. |

## What is NOT missing (already approved, do not re-ask)

- Phase-one scope, journey-step copy and the "founding cohort opens 7 December 2026" date — approved in `phase-one.tsx`.
- Review-capture framing for Home (synthetic fixture captures, labelled) — shipped in #191.
- The A102 social post batches — delivered 13–14 Nov (`docs/delivery/2026-11-13/kimi-a102-social-drafts.md`, `docs/delivery/2026-11-14/kimi-a102-social-drafts-20261114.md`).
- The A103 contractor guide pilot — `docs/marketing/contractor-guide-pilot.md`.
- Marketing navigation and identity copy — shipped (#187, #190, #192 per tracker).
