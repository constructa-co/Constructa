# CON-010 — Preview terms: client-facing proposal document terms (draft for review)

**Status:** Draft for Rob's review. Not published into any app route. Not legal advice.
**Date of this draft:** 15 November 2026
**Prepared for:** Robert ("Rob") Smith, Constructa

**Interpretation note (please correct if wrong):** CON-010 is read as the terms shown to the *client* in the proposal preview and published proposal document — the wording rendered by `src/components/proposal/proposal-document-view.tsx` (terms section), reviewed via `current-terms-review.tsx`, and published through `publishProposalAction`. This is distinct from the **platform terms of service** (Constructa-to-contractor, `src/app/terms-of-service/page.tsx`, technical revision `platform-tos-2026-03`), which this document does not change. If CON-010 instead meant platform terms preview wording, say so and I will re-draft.

**What the product guarantees today (from code at HEAD `33d8fd3f`) — the draft below must stay consistent with these hard rules:**

- The client can only ever be asked for a **non-binding** response: "acknowledgement" or "non-binding intention to proceed". Binding acceptance cannot be requested online (`src/app/dashboard/projects/proposal/actions.ts:419`, `src/app/proposal/[token]/response-client.tsx:35`).
- The contractor decides the terms content; the app renders the twelve STANDARD_PROPOSAL_TERMS or the contractor's overrides (`src/lib/proposal-terms.ts`).
- What is published is what was reviewed — immutable snapshots with content fingerprints; an earlier version is superseded, never edited.
- Hidden terms are never shown to the client.

---

## Draft wording for the published document

### Part A — Status and response (rendered around the terms list)

1. **What this document is.** This proposal is a quotation for the works described in the scope and price sections. It is an invitation to proceed, not a contract. A binding contract forms only when you and [Contractor company name] sign a formal contract or otherwise conclude one in writing. `[DECISION — Rob]` — confirm this formation statement matches how Rob actually contracts (some contractors treat the proposal + written acceptance as the contract; the wording must match reality).
2. **Responding online.** The only responses that can be recorded on this page are: (a) an acknowledgement that you have received and read this proposal, and (b) a non-binding statement that you intend to proceed. Either response confirms nothing legally and does not commit you or the contractor. `[DECISION — Rob]` — confirm the "intends to proceed" wording cannot be read as acceptance; current code labels it "a non-binding intention to proceed" (`publication-history-panel.tsx:48`), keep exactly that.
3. **Validity.** This proposal is open for response until [expiry date], after which it is closed and replaced versions supersede it. `[DECISION — Rob]` — set the validity period (commonly 14 or 30 days) and confirm the platform's expiry mechanism matches the stated period.
4. **Price.** Prices are [exclusive/inclusive] of VAT as shown in the price section. `[DECISION — Rob]` — the app prices both before and after VAT (evidence screenshots "1100beforeVAT1320incl"); the terms must say which is contractual and whether VAT is included at the stated rate.
5. **Your information.** The contractor holds your name and contact details to prepare, send and follow up this proposal. Constructa, the platform used to prepare and send it, processes those details only to deliver the document and record your response. `[DECISION — Rob]` — once the CON-009 privacy notice is settled, align this paragraph with it (lawful basis, retention of client contact data, contractor-as-controller for their client data vs Constructa-as-processor — this controller/processor split for client data needs deciding and stating in both documents).

### Part B — Terms clauses (the standard set shown to the client)

The twelve standard clauses as coded at HEAD (`src/lib/proposal-terms.ts`) are reproduced below with review flags. These predate the platform and were not drafted for it; Rob should have them checked before they are relied on as a standard set.

1. **Jurisdiction** — Law of England and Wales; language English. *(No flag.)*
2. **Responsibilities** — Works per scope; statutory requirements, British/European Standards, best practice. *(No flag.)*
3. **Alternative Dispute Resolution** — Escalation via Adjudication; RICS Homeowner Adjudication Scheme. `[DECISION — Rob]` — the RICS *Homeowner* scheme fits domestic/consumer clients only. If proposals also go to commercial clients, decide whether this clause changes per client type or names a different scheme.
4. **Liability** — 12-month Defect Liability Period from Completion Certificate. `[DECISION — Rob]` — confirm 12 months is the intended standard (some trades expect 6 or 24) and that "Completion Certificate" is defined elsewhere or replaced with Practical Completion (clause 11 uses Practical Completion — the two terms are used inconsistently).
5. **Workmanship** — reasonable skill and care of a competent contractor. *(Standard Supply of Goods and Services Act 1982 / Consumer Rights Act 2015 wording family; no flag.)*
6. **Insurances** — public liability, employers' liability, contractors all risk; evidence on request. *(Statutorily employers' liability is mandatory anyway; no flag.)*
7. **Payments** — 21 calendar days from application; pay-less notice within 7 days. `[DECISION — Rob]` — "receipt of Application" assumes a payment application regime; for domestic clients paying a fixed quote this clause may not match how Rob invoices. Confirm.
8. **Change Management** — variations in writing; response within 7 calendar days with cost/time implications. *(No flag.)*
9. **Health, Safety & CDM** — client deemed Domestic Client under CDM 2015; contractor acts as Principal Contractor. `[DECISION — Rob]` — hard-coded "Domestic Client" is wrong whenever the client is commercial; decide whether this clause is edited per project (the app supports per-proposal term overrides) or reworded generically.
10. **Materials & Ownership** — materials remain contractor's property until paid in full; risk passes on delivery to site. *(No flag, but note retention-of-title depends on the materials being identifiable/fungible — solicitor check optional.)*
11. **Practical Completion** — certified in writing by the Contractor; minor snags do not prevent PC if remedied within the DLP. `[DECISION — Rob]` — contractor self-certifying PC is contractor-favourable and unusual; confirm intent and reconcile with clause 4's "Completion Certificate".
12. **Confidentiality** — proposal terms/pricing confidential between the parties. *(No flag.)*

`[UNVERIFIED — Rob]` — the origin and legal review status of these twelve clauses is not recorded anywhere in the repo. Confirm they are Rob's own standard terms and whether a solicitor has seen them.

### Part C — Presentation notes for the preview/review screens (not client wording)

- The review screen already carries honest framing: "It is not a legal check of the terms or a confirmed original version of them" (`current-terms-review.tsx`). Keep that.
- The evidence screenshots show the preview displays "non-binding intent" wording (stage2-tranche-2d/21b) — Part A paragraph 2 must match that rendering exactly wherever it appears (public page, email, PDF).
- Hidden terms must never appear in any preview or published surface (enforced in code; do not weaken).

---

## Gaps and decisions register

| # | Item | Type | Blocking use? |
|---|---|---|---|
| P1 | Contract formation statement (proposal vs signed contract) | DECISION | Yes |
| P2 | Client type: domestic-only or mixed (affects clauses 3 and 9) | DECISION | Yes |
| P3 | Validity period of a published proposal | DECISION | Yes |
| P4 | VAT inclusive/exclusive statement | DECISION | Yes |
| P5 | Controller/processor split for client contact data between contractor and Constructa; alignment with CON-009 privacy notice | DECISION | Yes |
| P6 | Reconcile "Completion Certificate" (cl. 4) vs "Practical Completion" (cl. 11); who certifies | DECISION | Yes |
| P7 | Payment clause (cl. 7) fit with how invoices are actually issued | DECISION | Yes |
| P8 | Legal review status of the twelve standard clauses | UNVERIFIED | Yes for reliance |
| P9 | Whether CON-010 target is client-facing preview terms vs platform terms preview wording | CONFIRM | If misread, re-draft |
