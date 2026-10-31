# A023 platform terms / consent — Rob's approval sheet

Prepared 2026-10-31 from Rob 31 Oct 08:30/08:32. One question at the end, yes or no.

## 1. What Rob has already approved vs what he has not

Rob already approved the **March 2026 platform terms text for the QA exercise**. That approval stands and is not missing; nothing below re-asks it.

What approval of means here (and only here): the words shown on `/terms-of-service` (dated "Last updated: March 2026", `src/app/terms-of-service/page.tsx:32`) are accepted as the text to test consent against in the protected QA environment. The technical marker `platform-tos-2026-03` (`src/lib/platform-terms.ts:31`) is just how the software names that revision — it is **not** a lawyer's approval and not a legal sign-off (`src/lib/platform-terms.ts:14-17`).

Not covered by the existing approval:

- Final public launch approval of the terms as legally binding text (Section 4).
- The platform terms are separate from the twelve proposal contract clauses (`src/lib/platform-terms.ts:23-25`); this sheet does not touch those.
- The privacy policy is an explicitly marked **draft** ("Draft, not yet legally approved", `src/app/privacy-policy/page.tsx:10-11`) and must not be treated as approved facts.

## 2. The one human decision still needed

Codex (or any tool) must never tick the box or submit acceptance for Rob. A prior "yes" to running QA is **not** automated acceptance.

The decision: Rob, or a human he designates, will personally do one signup test on the protected QA candidate, on a disposable identity:

1. Read the actual terms page at `/terms-of-service` on the QA build.
2. Create the disposable account and **personally** tick the checkbox and submit signup (`src/app/login/page.tsx:243-262`).
3. Confirm the email privately, then sign in and, if prompted, personally tick the completion checkbox on the platform terms completion page (`src/app/auth/platform-terms/completion-client.tsx:70-83`).

## 3. What gets recorded and what evidence is still missing

Each acceptance stores exactly: the user's server-side id, the fixed document name, the revision string `platform-tos-2026-03`, and the database's own timestamp (`src/lib/platform-terms-acceptance.ts:107-113`). No browser timestamp, no caller-supplied identity. An unchecked box records nothing (`src/lib/platform-terms-acceptance.ts:68-70`); an unrecognized revision is refused (`src/lib/platform-terms-acceptance.ts:98-101`). The schema and CHECK constraint were applied 27 Oct — no replay needed.

Still missing evidence (operator prerequisites, not provable from a local build):

- A run of the real flow — checkbox, signup, email confirmation, first login, recorded row — against the exact approved QA candidate. **Unknown**: which deployed commit is the QA candidate today.
- Whether signup is currently enabled on that candidate (the signup action hard-answers `signup-disabled` while signup is OFF, `src/app/login/page.tsx:24-25`). Unknown from source alone.

No identities, tokens or secrets are printed here; the disposable identity is chosen and handled privately by Rob.

## 4. What remains Rob's responsibility at launch

Final launch legal, business and privacy review (real counsel or designated owner) is Rob's responsibility. This sheet supplies no business facts and no certification of legal adequacy; the privacy draft in particular is incomplete by its own label (`src/app/privacy-policy/page.tsx:21-22`).

## The question Rob can answer now

**Yes or no: "I will personally run the one disposable-identity signup test in Section 2 on the protected QA candidate, ticking the terms checkbox myself."**

A yes permits exactly that QA-scope action and nothing else — no production, no publish, no deploy, no settings change, no sign-up enablement, no merge. It closes the human-decision gap for A023 QA evidence; the Section 4 launch review stays open and separate.
