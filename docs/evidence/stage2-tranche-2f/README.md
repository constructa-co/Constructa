# Stage 2 Tranche 2F: walkthrough blocker repair, evidence

- Base: `ac00de7ab072fd2211386384ea626c7642095c74` (head of draft PR #85)
- Branch: `claude/stage2-tranche-2f-blockers`
- Issues: #86, #87, #88
- Captured: 5 October 2026, from the code in the commit that adds this folder
- Owner's retest steps: [`OWNER-RETEST.md`](OWNER-RETEST.md)
- Harness and how to run it: [`e2e/README.md`](../../../e2e/README.md)

The owner walkthrough of 5 October did not pass. Its findings are in
[`../stage2-tranche-2e/OWNER-WALKTHROUGH-FINDINGS.md`](../stage2-tranche-2e/OWNER-WALKTHROUGH-FINDINGS.md).
This tranche repairs the three release-proof blockers and nothing wider.

## What was wrong and what changed

| Issue | Cause found | Repair |
| --- | --- | --- |
| #86 Preview built against production | Only the Playwright harness checked which Supabase project was targeted. A Vercel preview had no check, so one that inherited the production variables built and ran. | One guard, loaded by `next.config.mjs` for every build and start. A preview or E2E context must declare its disposable project; the URL and both keys must belong to it; nothing may name production; missing values fail. A second check reads the compiled bundle. Production is never checked. |
| #87 Proposal showed one "General" stage for a week | The detailed programme planner invented the programme. Opened on a job with none, it took one stage per estimate section (a simply priced job is all section "General", placeholder five days) and its autosave wrote that, with a start date, half a second later. Opening it also discarded stages typed in the simple editor and not yet saved. With labour hours in the estimate it replaced saved stages with estimate sections. | The planner opens on the saved stages unchanged and never saves a suggestion by being opened. It is not opened over unsaved stages. "General" is not offered as a stage name. A proposal is sent only when every saved stage appears in it. |
| #88 Sending blocked without saying why; manual payment stages; no PDF before sending | The Send section said only "Finish the required items above". Payment stages were typed row by row. No PDF existed until after publishing, and nothing tied what was read to what was sent. | The missing items, each with its fix, sit beside the disabled tick box and Send button. Three payment choices: on completion, deposit and balance (the balance is worked out), custom. A draft PDF can be downloaded before sending. The server publishes only the content that was reviewed. |

The earlier journey did not catch #87 because it checked the start and finish
dates and never the stage names, and never opened the planner.

## Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 493 warnings (historical; none in new code) |
| `npm test` | 46 files, 807 passed, 4 skipped (the #34 quarantine) |
| `npm run build` | passes with no environment, as CI runs it |
| Guard builds | 6 cases behave as designed: [`supabase-target-guard.txt`](supabase-target-guard.txt) |
| `npm run e2e:evidence` | 4 of 4 passed |

### Browser journey

A production build on `127.0.0.1`, driven by the installed Chrome, writing to
the disposable Supabase project `constructa-e2e-pr79` through the real server
actions. Synthetic data only. The AI model and the email service were the
loopback stub. The same isolation proofs as Tranche 2E ran first, and the
application's own guard now runs as well.

| Project | Viewport | Input | Steps | Checkpoints | Controls measured | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `desktop` | 1440×900 | mouse | 13 | 31 | 903 | pass |
| `tablet` | 768×1024 | touch | 13 | 31 | 904 | pass |
| `phone` | 390×844 | touch | 13 | 31 | 727 | pass |
| `desktop-keyboard` | 1440×900 | keyboard only | 12 | 22 | 599 | pass |

Across all 115 checkpoints: no sideways page scroll, nothing past the
viewport, no control under a pinned bar, and no axe violation of any impact
(WCAG 2.2 A and AA). On the tablet and phone no primary control was under
44×44 px, including every control added in this tranche. The keyboard run
reached 82 controls with Tab and Shift+Tab alone; every one showed a visible
focus indicator.

Three checkpoints are new: `programme-unsaved-planner-refused`,
`review-payment-preset` and `review-presend-pdf`.

## Acceptance criteria and their evidence

### #86 Preview isolation

| Criterion | Evidence |
| --- | --- |
| A preview configured with the production project reference fails before deployment | Guard case 1: fails in one second, before anything is compiled. Unit: "fails the incident", and the same through `next.config.mjs` itself |
| A correctly isolated preview builds and its client bundle contains only the disposable reference | Guard case 3: both lines `PASS`, "projects in build" is the one declared. Case 4: a bundle compiled for another project fails |
| Production deployment remains unaffected | Guard case 5. Unit: production is never checked whatever it holds; a stray declaration cannot stop it; the post-build script cannot fail a production build even when the build cannot be read |
| The check runs automatically on every release-candidate preview | It is in `next.config.mjs`, so it runs for every `next build` and `next start` whatever the build command. The bundle check is part of `npm run build` |
| No secret values are printed or committed | Unit: "never prints key material, in a pass or in a failure". The six build logs contain no key material. Only project references are shown |
| Disposable-preview credentials absent | Guard case 2 |
| Safe teardown and rotation documented | `DEVELOPMENT.md`, "Preview and E2E database isolation" |

### #87 Programme parity

| Criterion | Evidence |
| --- | --- |
| Multiple saved stages appear in the proposal in the same order with the same dates | Journey, all four projects: three stages by name, each with its own dates, in the review preview, the pre-send PDF, the client's page and the client's PDF. `12-programme-saved`, `14-review-ready`, `20-public-acknowledgement` |
| Editing and reloading does not lose or collapse stage data | Journey: reload shows the same three stages and lengths; opening and closing the planner on them changes nothing. Unit: the Programme screen reopens on the same stages |
| Preview, PDF and public view have programme parity | `proposal-parity.test.ts`: one plan, worked out by hand, required of the review screen, the preview snapshot and the sent snapshot; the programme section of the preview and of the client's page are identical; both PDFs print the same stages and dates |
| A missing programme is a clear blocker, not invented "General" data | Unit: no programme section and no "General" anywhere; a stage suggested but never given a start is not a programme; publishing is refused. Journey: opening the planner on an empty job saves nothing (`plannerSuggestionNotSaved` in each results file) |
| Regression coverage includes a three-stage programme | `proposal-parity.test.ts`, `planner-phases.test.ts`, and the journey |
| A saved stage is never silently left out | Unit: a stage with no length blocks sending with the reason, on the screen and again on the server |

### #88 Readiness, presets and the pre-send PDF

| Criterion | Evidence |
| --- | --- |
| Disabled controls state why and provide a direct fix | Journey: beside the Send button, "You can't send yet. 2 things are still needed", with **Open Programme** (followed, and it opens the programme) and the payment choices. The tick box and the button are described by that explanation. `09-review-send-blocked` |
| A preset without working out percentages | Journey: "Deposit and balance" gives Deposit 30% and Balance 70% with their amounts, £3,226.24 and £7,527.89, which add up to the price. Unit: the balance follows any deposit; an unusable deposit is refused, never guessed. `13-review-payment-preset` |
| Readiness updates without a stale state | Journey: "Everything needed is in place", the blocker gone and the tick box enabled, while the status still says "Unsaved" |
| The exact PDF is downloadable before send | Journey: the draft PDF is downloaded, read back, and states every fact the proposal states; the database holds no publication afterwards. `15-review-presend-pdf`, [`proposal-presend-draft.pdf`](proposal-presend-draft.pdf) |
| Reviewed preview and PDF match the sent immutable version | Unit: with only the draft marking, reference and dates of issue taken away, the full text of the pre-send PDF equals the full text of the client's PDF; the two documents are equal section for section; the two snapshots differ only in id and timestamps. The server refuses to publish when any of the price, a stage, the start date, a payment stage, the scope, the terms, the company profile, the VAT treatment or the response asked for has changed since review. Journey: the check code on the draft PDF is the one shown when version 1 is published (`19-published-email-sent`) |
| Phone and keyboard-only checks pass | `phone` and `desktop-keyboard` rows above. The keyboard run fixes the payment blocker from beside the Send button and focus moves to the tick box it enabled |
| Responses stay non-binding; no internal build-up shown | Unchanged and re-proved: no acceptance control on any screen, no `accepted` event in the database, and overhead, risk and profit absent from the preview, both PDFs and the client's page |

## Behaviour that changed on purpose

- **The detailed planner no longer follows the estimate by itself.** It used
  to rebuild its stages from estimate sections whenever the estimate carried
  labour hours. It now keeps what is saved. "Regenerate from estimate" still
  does it on request, and asks first when stages are saved.
- **A proposal whose programme has an unusable stage cannot be sent.**
  Before, a stage with no name or no length was left out and the rest sent.
  Now it is a blocker with the reason.
- **Sending needs the screen's content fingerprint.** A browser tab loaded
  before this change cannot publish until it is reloaded. It is told the
  proposal has changed and to read it again.
- **A preview without `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF` does not
  build.** That is the fail-closed rule. It must be set in Vercel's Preview
  environment before the next preview of this branch.
- **The stage list beside the plan in a sent snapshot** is now written from
  the plan: its lengths are working days and each stage carries its start
  date. Nothing reads it for a publication that has a plan.

## Recorded, not repaired

- **The planner and the proposal still count time differently.** The planner
  lays stages on a weekly grid and offers 4, 6 and 7-day weeks; the proposal
  counts Monday to Friday. The stages, their order and names now agree
  everywhere, and the proposal's dates are the ones shown on the Programme
  screen's own preview, but the planner's summary can show a later finish.
  Unifying the two is Stage 3 work (#27).
- **The check code changes with the version number.** After version 1 is
  sent, the draft for version 2 has a new code even if nothing else changed.
- **Controls inside the two optional advanced workspaces** are measured and
  reported, not enforced, as in Tranche 2E.
- **Everything in the Tranche 2E "Recorded, not repaired" list** stands.

## Not covered by this evidence

A real Vercel preview deployment of this branch, real fingers and a real PDF
viewer on a phone, the live AI model and real email. The first needs the
Preview variable above; the rest are what the owner retest is for.
