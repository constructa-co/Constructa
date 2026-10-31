# CQ-0030 Marketing Contact — Cohort Preview Contact Page

PASS

Date: 2026-11-01
Branch: `cq/cq-0030-marketing-contact` (worktree `cq-0712-a091-connected-flow`)
Authority: Rob 01 Nov 00:05 — marketing SOURCE/A001 builds released; phase-one preview has no new lead-processor authority.

## Scope

Owned and changed (uncommitted, left for the runner):

- `src/app/contact/page.tsx` (modified) — adds existing `getLaunchProfile()` gating: non-`full` profiles render the new cohort component; the `full` branch is the previous page JSX preserved verbatim (same Formspree action `https://formspree.io/f/xnnprlod`, `method="POST"`, same fields, copy and mailto). No fetch/activation of the processor was added; the form remains plain HTML with no `onSubmit`.
- `src/components/marketing/cohort-contact.tsx` (new) — `PhaseOneContact` export. Charcoal/sage styling tokens (`#101211` base, `#c9efcf` sage accent, Avenir Next stack) matching the approved phase-one typography, but in its own module.
- `src/components/marketing/cohort-contact.module.css` (new) — self-contained CSS module; `phase-one.module.css` and `phase-one.tsx` (Claude/Cursor-owned) were NOT edited.
- `src/app/contact/contact-launch-profile.test.tsx` (new) — the one focused new contact test.
- `src/app/contact/contact-labels.test.tsx` (modified, minimal adaptation only).

Metadata made neutral per task permission: description is now `Contact the Constructa team.` (was `…want early access—we'd love to hear from you.`), removing the early-access promise from the route. Title unchanged.

## Cohort behaviour (no live calls)

- Single accessible `<h1>` ("Talk to the team behind phase one."), plus an `aria-labelledby` "What to expect" panel.
- Contact path is only `mailto:hello@constructa.co` (twice: primary link and a plain-text fallback link) — a user email-client action. No `<form>`, no `action=`, no `method=`, no `formspree` string anywhere in the cohort render.
- Truthful copy: states the page has no form and sends nothing; asks users not to paste private project/customer details; makes no early-access/signup/free-trial promise, no response SLA, no address/certification, no prices.
- Navigation back to existing pages: `/features`, `/pricing`, `/` — all internal links or mailto only.
- No launch/capability constants changed; no gates flipped; nothing sent, submitted, fetched or activated.

## Test adaptation (for independent review before acceptance)

`contact-labels.test.tsx` previously called `ContactPage()` with no env stub, which after gating resolves to the cohort view. Adaptation:

1. Added `beforeEach`/`afterEach` with `vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full")` so the file explicitly targets the full-profile legacy component.
2. Updated the metadata assertion to the neutral description.

No name/email/message label assertions, form-contract assertions, class assertions, or copy assertions were deleted or weakened; they remain verbatim, including the Formspree action/method check.

## Literal checks and results

Command (existing root deps only, Node v26.12.1 runtime, no install/build):

```
npx vitest run src/app/contact
```

Result: `Test Files 2 passed (2) · Tests 9 passed (9)` — 3 legacy tests (full profile) + 6 new tests:

- full: Name/Email/Message labels by unique ids; form contract (action/method/classes/required/placeholders), Send Message button, mailto, legacy copy, metadata.
- cohort: mailto present, zero forms/inputs/textareas/buttons, no `formspree`/`action=`/`method=` in markup; exactly one non-empty `h1`, zero labels, no data-entry fields; banned-copy scan (`early access`, `free trial`, `trial`, `sign up`, `signup`, `guarantee`, `same day`, `within 24`, `certified`, `registered office`, `formspree`) plus no `£/$/€` in rendered text; all anchors internal or mailto, including `/features`, `/pricing`, `/`; neutral metadata assertion.
- full branch re-verified in the new file: legacy form retained with existing processor and destination.

`npx eslint` on the five files: 0 errors; 3 pre-existing `react/no-unescaped-entities` warnings on untouched legacy copy lines in `page.tsx` (present before this change).

Not run (per task): `next build` / npm build / install / dep copies, env reads, DB/provider/browser calls, broad app suites, secret scans (no new secret-bearing material introduced; only a pre-existing public Formspree URL retained in the full branch).

## File hashes (SHA-256)

| File | SHA-256 |
| --- | --- |
| `src/app/contact/page.tsx` | `07ee72dc3d40d06bbb0bf3036ebb973c91228f6fd787086670d5ce97377540e0` |
| `src/app/contact/contact-labels.test.tsx` | `c5c8d2cb782db92428e08eea2521ca41981d000e46b1fadf1ae9cbc1eaabb85b` |
| `src/app/contact/contact-launch-profile.test.tsx` | `a0d666fe3081e7109ca1c321ebf2b9e77828b0e7615cb835c3026b627ab01e5c` |
| `src/components/marketing/cohort-contact.tsx` | `3d304026656ad3ea3fd7549d0c005d81c9342eeb27f59c1f5dc63f27e7214254` |
| `src/components/marketing/cohort-contact.module.css` | `fd79e525a628ed7fb4cfd6570817857c8184f6e3775df032d0ffd5e7d018127f` |

## Scope limits / notes

- No push, merge, PR, deploy, SQL, settings/keys, form submission or live calls. Changes left uncommitted for the runner.
- No inbox/progress/register edits. Temp files: none created outside the repo (`$TMPDIR` not needed).
- `phase-one.tsx` / `phase-one.module.css` untouched; cohort styles duplicate the approved tokens in a separate module rather than sharing the owned files.
- The full-profile legacy Formspree form is preserved as historical behaviour only; this work does not endorse it or assert consent/authority beyond preserving the existing branch.
- Recommended next step: independent Claude review of the `contact-labels.test.tsx` adaptation (env stub + neutral metadata expectation) before acceptance; no Grok involvement.
