# Stage 2 Tranche 2E: release-proof evidence

- Baseline: `031776771147f3cd2063ea66b447d0df7f099684`
- Branch: `claude/stage2-tranche-2e-release-proof`
- Captured: 4 October 2026, by `npm run e2e:evidence`, from the code in the commit that adds this folder
- Harness and how to run it: [`e2e/README.md`](../../../e2e/README.md)
- Owner's real-device checklist: [`OWNER-WALKTHROUGH.md`](OWNER-WALKTHROUGH.md)

## What ran, and where

A production build (`next build`, `next start`) on `127.0.0.1`, driven by the
installed Google Chrome through Playwright. Unlike the Stage 2A to 2D
evidence, nothing here is a mounted component with stand-in server calls:
every screen is the real route, signed in, writing to a real Supabase
project through the real server actions.

That project is the disposable `constructa-e2e-pr79`. Before any test ran,
the harness proved the project sentinel, the URL, the `ref` claim of both
keys and the project compiled into the build. In each run the sign-up request
was checked to have gone to that project and the new account was read back
from it. The browser was allowed to reach only the local server and that
project; the only other hosts requested were the page's own analytics
scripts (`plausible.io`, `www.clarity.ms`), which were blocked.

Synthetic data only: `e2e-<run>-<project>@example.com` contractors,
"Example Bathrooms Ltd", client "Alex Client" at `alex.client@example.com`.
The AI model and the email service were a loopback stub, so no prompt
reached a model and no email left the machine. The stub accepted 25 emails
across the four runs, every one to an `@example.com` address, and failed 3 on
purpose.

## Result

| Project | Viewport | Input | Steps | Checkpoints | Controls measured | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `desktop` | 1440×900 | mouse | 13 | 28 | 796 | pass |
| `tablet` | 768×1024 | touch | 13 | 28 | 797 | pass |
| `phone` | 390×844 | touch | 13 | 28 | 646 | pass |
| `desktop-keyboard` | 1440×900 | keyboard only | 12 | 19 | 479 | pass |

Across all four runs and all 103 checkpoints: no sideways page scroll, no
element past the viewport, no control under a pinned bar, and no axe
violation of any impact (WCAG 2.2 A and AA, default theme). On the tablet and
phone no primary control was under 44×44 px. The keyboard run reached 87
controls with Tab and Shift+Tab alone; every one showed a visible focus
indicator.

Per-run detail is in `results-desktop.json`, `results-tablet.json`,
`results-phone.json` and `results-desktop-keyboard.json`: for every
checkpoint the document and viewport widths, each undersized control with
its size, anything obscured, every axe finding, and for the run the parity
figures, the database's own record of each publication, the hosts blocked
and the provider record.

## Acceptance criteria and their evidence

Screenshots exist at `…-1440x900.jpg` and `…-390x844.jpg`. Every assertion
named here is a hard check in `e2e/phase1-journey.spec.ts` and ran on all
four projects unless marked.

| Criterion | Asserted by the journey | Capture |
| --- | --- | --- |
| Authentication | Signed-out `/dashboard` goes to `/login`; sign-up creates the account in the disposable project; sign-in lands on setup | `01-account-created` |
| Onboarding completion | An empty trade is refused with a message; two steps; finish lands on the first job | `02-setup-business` |
| One blank project, zero to first | "Add your first job"; an empty name is refused; creation opens the Brief for that project; the pipeline then holds exactly that job | `03-first-project`, `23-pipeline` |
| Brief suggestion pending until Apply | The suggestion shows as "not applied" and the contractor's text is unchanged until Apply | `04-brief-suggestion-pending`, `05-brief-review` |
| Simple estimate, explicit Preliminaries, non-default risk | One-price line, quantity-and-rate line, a Preliminaries-section line, risk 7.5%; every figure equals the independently computed value; no server refusal | `06-estimate-advanced-open`, `07-estimate-priced` |
| Programme start, duration, end, mini Gantt | Start on a Monday, three weeks finishes on the right Friday with one bar; three stages finish on the computed date with three bars | `11-programme-saved` |
| Readiness blocks publication | Programme and payment stages listed as missing; Send disabled with the reason | `08-review-not-ready`, `09-review-send-blocked` |
| Acknowledgement is the default | Two options, the acknowledgement one checked; "Neither option is acceptance" | `14-send-acknowledgement-default` |
| Immutable publication, persistent link | Version 1 published; link on the server under test; a later draft edit does not appear on the public page; the link still shows the recorded response after reload | `16-published-email-sent` |
| Anonymous public HTML and PDF | A browser with no session opens the proposal; the PDF downloads and its text is checked | `17-public-acknowledgement`, `proposal-acknowledgement.pdf`, `pdf-acknowledgement-page-1`, `-2`, `-4` |
| Acknowledgement and contractor history | "Receipt confirmed" recorded; history shows it with the client's name; database events `published … viewed, acknowledged` | `18-public-acknowledgement-recorded`, `19-contractor-history-acknowledged` |
| Non-binding intent (not `desktop-keyboard`) | Version 2 asks for an intention to proceed; wording, button and recorded state; history and database say `non_binding_intent` | `20-public-non-binding-intent`, `21-…-recorded`, `22-contractor-history-non-binding-intent`, `pdf-non-binding-intent-page-4` |
| No binding acceptance | No accept control on the send screen or either public page; no `accepted` event in the database; history never says "Proposal accepted" | as above |
| Launch-profile gating | Billing, Contracts, Live and Home redirect to the pipeline with the notice | `24-later-module-unavailable` |
| Truthful failure and retry | Programme save with the connection dropped: "Failed - try again", stages still typed, saves on retry. Email failed at the provider: publication stands, retry sends it. Client response without a name: refused, then accepted (not `desktop-keyboard` for the first two) | `10-programme-save-failed`, `15-published-email-failed`, `16-published-email-sent` |
| Financial, VAT, programme and wording parity | £10,754.13 before VAT, £2,150.83 VAT, £12,904.96 including VAT, start Monday 2 November 2026 and finish Tuesday 24 November 2026 on the estimate, review, preview, public page and in the PDF text; overhead, risk and profit absent from everything the client sees | `parity` in each results file |
| Light document in either theme | Document background luminance 1.0 in both themes while the application surface goes from 1.0 to 0.01 | `13-review-other-theme-document-stays-light` |
| Public proposal readable without zoom | Notice text at least 16 px; no sideways scroll at 390 px | `17-public-acknowledgement-390x844` |
| Keyboard-only core path | `desktop-keyboard` | `results-desktop-keyboard.json` |

## Defects found and repaired

| # | Class | Defect | How it was shown | Repair |
| --- | --- | --- | --- | --- |
| 1 | P1 | Advanced estimating showed a new row before the server had created it. Anything typed into it straight away was refused by the server but stayed on screen and in the running total. Estimating showed £10,754.13; the proposal would have been sent at £10,158.15. | The journey's parity check failed at Review. The server answered "Line not found or unauthorized" to both edits. | The row appears only once the server confirms it. `advanced-estimate.tsx` |
| 2 | P2 | A change to a line's description re-sent its quantity and rate from an earlier render, and could undo a rate typed within the last 200 ms. | Seen in the database during exploration: description saved, rate back to 0. | Quantity and rate are sent only when one of them changed. `advanced-estimate.tsx` |
| 3 | Blocking P2 | "Try the email again" never worked outside the Stage 2D stand-ins. The retry read the delivery ledger with the contractor's session, which the Phase 1 grants make server-only, so every retry was refused, with nothing shown. | Journey: no second request reached the email provider. Unit test: with the grant modelled, three retry tests fail without the fix. | The ledger is read with the service role after ownership is proved. A refused retry now says why. `proposal/actions.ts`, `review-send-client.tsx` |
| 4 | Blocking P2 | Controls with no accessible name: side-navigation sign-out, the advanced estimate's fields and delete buttons, the pipeline's filters and stage selector. | axe `button-name`, `label`, `select-name` (critical). | Names added. |
| 5 | Blocking P2 | Text below 4.5:1 contrast: sign-in helper text, side-navigation section labels, the Brief's step label, the primary button's hover colour, pipeline greys and "Mark as Lost", advanced estimate labels. | axe `color-contrast` (serious). | Colours moved one or two steps. |
| 6 | Blocking P2 | The Brief's review list was not a valid definition list. | axe `definition-list`, `dlitem` (serious). | Terms and values sit directly in each group. `brief-client.tsx` |
| 7 | Blocking P2 | Controls under 44 px on touch screens: every sign-in field and button, the phone top bar's pipeline link, the side navigation at tablet width, the pipeline's filters and card actions. | Touch-target measurement. | 44 px minimum, below 1024 px where the desktop layout is deliberately compact. |
| 8 | Blocking P2 | On a phone the pipeline board was a 900 px strip with 850 px cards whose buttons sat off screen. At tablet width its filter row made the whole page scroll sideways. | Overflow and obscured-control measurement. | Stages stack at screen width on a phone; the filter row stacks below 1024 px. `project-board.tsx`, `dashboard-client.tsx` |

## Recorded, not repaired

- **Advanced estimating is still compact.** With it open, 53 of its controls
  are under 44 px (the smallest 20 px high). It is the only place an explicit
  Preliminaries line can be entered. On a phone it is a wide panel that
  scrolls sideways inside its own frame (`06-estimate-advanced-open-390x844`).
  The journey completes there on phone, tablet and by keyboard, it does not
  make the page itself overflow and it is now clean under axe, but it is not
  sized for a finger.
- **Pipeline and side navigation on the mouse-driven desktop** keep their
  compact sizes: 17 pipeline controls and 11 navigation controls under
  44 px at 1440 px. Both meet 44 px on tablet and phone.
- **"Mark as Won" on the pipeline** sets the project's proposal status to
  accepted. It is the contractor's own record and nothing is shown to or
  asked of the client, but it is a route to an "accepted" status in the
  cohort profile.
- **A failed edit in Advanced estimating** shows an error but leaves the
  typed value on screen and in the total until the page is reloaded.
- **The full-dark theme** was checked for the proposal document staying
  light. It was not scanned screen by screen.
- **A phone has no theme switch.** It follows the preference saved for the
  account.
- **The sign-up message** tells the contractor to check their email for a
  confirmation link even where confirmation is switched off.

## Not covered by this evidence

The live AI model's wording, real email delivery, a real phone's PDF viewer
and real fingers. Those are what the owner walkthrough is for.
