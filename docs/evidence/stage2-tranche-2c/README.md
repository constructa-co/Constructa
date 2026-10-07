# Stage 2 Tranche 2C — evidence

- Baseline: `7104460bc2702304d98ceff602d4a60bcaa00b1f`
- Branch: `claude/stage2-tranche-2c-guided-brief-estimating`
- Captured: 3 October 2026, from the code in the commit that adds this folder

## Data and identity

Synthetic data only. No real customer data, credentials or secrets were used.

- Contractor: `contractor@example.test`
- Project: "14 Example Road bathroom refit" for client "Alex Client", id `synthetic-project-1`
- Established estimate: "Estimate v1" (four lines across Demolition, Plumbing and Finishes, one of them a rate build-up; preliminaries 10%, overhead 10%, risk 5%, profit 15%, discount 2.5%) and "Estimate v2 (budget option)"
- No Supabase, OpenAI or other backend credentials were present in the workspace. Nothing was written to any database and no AI model was called.

## How it was captured

The real routes need a signed-in Supabase session, which this workspace does
not have. Screens were captured from a temporary local harness that mounted
the real components with synthetic props:

- `DashboardShell` + `ProjectNavBar` + `BriefClient` for the Brief
- `DashboardShell` + `ProjectNavBar` + `EstimateClient` for Estimating, which loads the real `AdvancedEstimate` workspace when the disclosure is opened

The server calls were replaced through the components' own `ask`, `save`,
`server` and `loadAdvancedData` props with stand-ins that wait 300–600 ms and
then succeed, or fail once when told to. The assistant stand-in returns one
fixed reply. A temporary rewrite sent `/dashboard/projects/brief` and
`/dashboard/projects/costs` to the harness, so the real client-side
navigation from "Build the price" could be followed and the phone top bar
shows the real page titles.

The harness, the rewrite, the local launch configuration and the capture
script were deleted before commit and are not part of the branch.

- Build: production (`next build` + `next start`) on localhost
- Browser: headless Google Chrome driven over the DevTools protocol; real DOM clicks and input events
- Viewports: 1280×800 desktop, and 390×844 phone (device scale 2, touch on)
- Each screenshot shows one viewport, scrolled to the part named in the table
- `capture-metrics.json` records, for every screenshot: the URL, the viewport width, the document and page-scroller widths, the right edge of the widest visible element, any tap target under 44 px, and values read back from the page (typed inputs, totals, the requests the stand-ins received)

## Files

Each state has a `-1280x800.jpg` and a `-390x844.jpg` version. All are in the
default light theme except 24 and 25.

| File | Shows |
| --- | --- |
| `01-brief-blank-start` | Brief for a blank project: step 1 of 4, empty description, status "Nothing to save yet" |
| `02-brief-ai-suggestion-pending` | After "Tidy this up for me": the suggestion in its own dashed panel marked "Suggestion · not applied", with Apply and Discard. The description field still holds the contractor's words |
| `03-brief-suggestion-applied` | After Apply: the description now holds the suggested wording, status "Unsaved", and a note that it is not saved yet |
| `03b-brief-applied-trades-step2` | Step 2 after Apply: the four suggested trades are now ticked |
| `04-brief-suggestion-discarded` | After Discard on a fresh page: the description read back as the contractor's own text, unchanged |
| `05-brief-ai-unavailable-manual-still-works` | The assistant fails: plain message, "Try the assistant again", and the description is still editable |
| `06-brief-site-step` | Step 3 filled in by hand: site notes, start date, rough value |
| `07-brief-review-unsaved` | Step 4 review with status "Unsaved" and the "Save and build the price" action |
| `07b-brief-leave-with-unsaved-changes-stays` | The Estimating tab was clicked with unsaved changes. The browser confirm shown is recorded in `capture-metrics.json`; Cancel was chosen and the page stayed on the Brief |
| `08-brief-save-failed-inputs-kept` | "Save and build the price" with the save failing: status "Failed - try again", the message, a Try again button, and the page still on the Brief. Not scrolled by the capture script: this is where the page puts the contractor |
| `08b-brief-save-failed-review-retained` | The same state lower down: every input still shown in the review |
| `09-brief-retry-saved` | After Try again: status "Saved". Two save requests were sent with identical payloads |
| `10-estimate-blank-state` | Arrived from "Build the price" at `/dashboard/projects/costs?projectId=synthetic-project-1`: no estimate, "No prices yet", one action, total £0.00, both disclosures closed |
| `11-estimate-first-line-one-price` | First line being typed as one price, with a live line total; the running total is still £0.00 |
| `12-estimate-first-line-saved-running-total` | First line saved: running total £9,500.00. The request carried `estimateId: null`, so the estimate was created by this save |
| `13-estimate-quantity-rate-line-form` | Second line as quantity, unit and rate (24 m2 × £65), line total £1,560.00 |
| `14-estimate-two-lines-running-total`, `14b-estimate-running-total-card` | Both lines saved: £11,060.00 before VAT, with VAT and the including-VAT total |
| `15-estimate-line-save-failed-input-kept` | Third line fails to save: message, "Try again", the typed description and amount still in the form, total unchanged at £11,060.00, still two saved lines |
| `16-estimate-line-retry-saved` | After Try again: three lines, £11,380.00. The retry reused the same line id and estimate id as the failed attempt |
| `17-estimate-remove-failed-line-kept` | Removing a line fails: the line and the total are unchanged, with Try again and Keep it |
| `18-estimate-price-adjustments-open`, `18b-estimate-price-adjustments-preview` | Price adjustments opened, overhead 10 and profit 15 typed: "Not saved yet" preview of £14,395.70 while the running total still reads £11,380.00 |
| `19-estimate-adjustments-saved-total` | Adjustments saved: overhead £1,138.00, profit £1,877.70, total before VAT £14,395.70 |
| `20-estimate-advanced-disclosure-open` | Advanced estimating opened: the capability list and the full BoQ workspace; the simple list is hidden |
| `21-established-estimate-simple-view`, `21b-established-estimate-total` | An existing multi-section estimate in the simple view: version picker, every line, the build-up line marked for the advanced workspace, and all five adjustments in the total (£18,932.24) |
| `22-established-estimate-advanced-workspace` | The same estimate in the advanced workspace: versions, percentages, sections and lines as before |
| `23-established-brief-data-preserved` | A previously saved brief reopened: description, status "Saved" |
| `24-brief-blank-start-dark-theme` | Blank Brief in the dark theme |
| `25-established-estimate-dark-theme` | Established estimate in the dark theme |

## Measured results

- Horizontal overflow: none. In all 62 captures the document width and the page scroller width equalled the viewport width, and no element outside its own scroller extended past the viewport.
- Two parts scroll sideways inside their own strip and are measured separately as `widestRightInsideOwnScroller`: the project tab strip (at 390 px the Proposal tab is reached by swiping the strip, as in Tranche 2A) and the advanced estimating workspace.
- Tap targets: none under 44 px in the Brief or the simple estimating screen, at either size, in any capture. Checkboxes in the suggestion panel are measured by their whole tappable row.
- The advanced workspace is the existing BoQ interface. It has controls under 44 px (counted per capture as `advancedWorkspaceTargetsUnder44`) and is laid out for a wide screen; the screen says so when it is opened.

## Limits of this evidence

- The failures are simulated by the stand-ins, not by a real network or database fault. The real actions' failure, retry, idempotency and lock behaviour is covered by unit tests against an in-memory stand-in for the database, not against a database.
- The assistant's reply is a fixed synthetic reply. No AI model was called, so these captures say nothing about the quality of real suggestions.
- The lazily created estimate in 12 is the stand-in's. That the real action inserts one estimate with zero percentages and one line, and removes the estimate again if the line fails, is shown by unit tests only.
- The browser confirm in 07b cannot appear in a screenshot; its text is in `capture-metrics.json`.
- Inside the advanced workspace nothing was edited, because its actions need a backend. 20 and 22 show that it opens and renders existing data.
- The measurements cover the contractor's content area. The sidebar and phone top bar are unchanged from Tranche 2A and are not measured here.
- The video walkthrough and drawing take-off are off in the default `cohort` launch profile, so the "Other ways to capture the job" disclosure does not appear in these captures.
- Server-rendered pages (`brief/page.tsx`, `costs/page.tsx`) were not exercised in a browser.
- No real phone was used. 390×844 is an emulated viewport.
