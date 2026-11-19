# CON-039 — Proposal terms for UK domestic clients (drafts)

**Status: PRIVATE REVIEW DRAFT · NOT APPROVED · NOT PUBLISHED · NOT LEGAL ADVICE**
Tracker: CON-039 (P1, Rob-gated — "Approved domestic terms copy pending.")
Finding: "Proposal terms not fit for UK domestic clients."

Ground truth: `docs/delivery/2026-11-16/d51-terms-gap.md` (Claude D51 delivery branch) documents the gap from source only — no clause was added, removed or reworded. The standard 12 clauses live in `src/lib/proposal-terms.ts` (`phase1-standard-v1`). Nothing below is legal wording for use with a client; every clause skeleton is a placeholder structure awaiting approved wording from Rob with qualified UK construction-law review.

---

## Draft A — Review-screen notice wording (the smallest safe step)

This is interface copy, not client-facing legal text. It tells the contractor what the proposal currently does. Ship only after Rob approves the wording.

> **Check the terms match your client**
>
> These terms are written for work for a homeowner. They state that the client is a domestic client (CDM) and name the RICS Homeowner Adjudication Scheme. If this job is for a business or organisation, review clauses 3 and 9 before sending, or choose terms written for commercial clients. [ROB TO CONFIRM] [second sentence stays only if a commercial set is approved; otherwise delete it.]

Behaviour note for Codex: this notice should read the brief's `client_type` and appear only when it says commercial while the standard set is selected. Wiring is a product decision, not part of this copy draft.

## Draft B — Clause-wording skeletons (placeholders only)

Structure for the decisions Rob listed in the D51 note (items 2–5). Each `[ROB TO CONFIRM] [...]` must be replaced by approved wording; until then these skeletons never leave this folder.

Clause 3 (Adjudication) — commercial variant skeleton:

> [ROB TO CONFIRM] [approved non-domestic dispute-resolution wording. Must not name the RICS Homeowner Adjudication Scheme for a commercial client.]

Clause 9 (Health, Safety & CDM) — commercial variant skeleton:

> [ROB TO CONFIRM] [approved CDM wording for a non-domestic client, including who holds Principal Contractor / Principal Designer duties.]

Optional additional clauses — domestic set skeletons (Termination / Final Account / Retention, per D51 owner decision 4):

> [ROB TO CONFIRM] [Termination clause wording — who may end the contract, notice, payment for work done.]
> [ROB TO CONFIRM] [Final Account wording — how the last payment is calculated and agreed.]
> [ROB TO CONFIRM] [Retention wording — whether retention applies, at what percentage, and when released.]

Payments reconciliation (D51 owner decision 5):

> [ROB TO CONFIRM] [one sentence tying clause 7 payment dates to the payment stages printed on the proposal, so the two cannot contradict each other.]

## Rules

- `phase1-standard-v1` remains the only default until Rob decides otherwise (D51 owner decision 1). Nothing in this draft changes that.
- No skeleton text may be copied into `src/lib/proposal-terms.ts`, the Contracts tab, or any proposal. They are shapes, not wording.
- If the decision is "domestic-only for the January cohort", Draft A's second sentence is deleted and this item closes with the notice copy as the only change.
