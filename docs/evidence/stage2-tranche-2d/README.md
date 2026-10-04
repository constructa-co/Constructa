# Stage 2 Tranche 2D — evidence

- Baseline: `bdf0ebecb83c78066cefa3f6e90d673b31b0b527`
- Branch: `claude/stage2-tranche-2d-programme-proposal`
- Captured: 4 October 2026, from the code in the commit that adds this folder

## Data and identity

Synthetic data only. No real customer data, credentials or secrets were used.

- Contractor: `contractor@example.test`, company "Example Building Ltd"
- Project: "14 Example Road bathroom refit" for client "Alex Client"
- The proposals come from `src/lib/__fixtures__/proposal.ts`: a typical one, a minimal one and an oversized one built to stress the page breaks
- Photographs and the logo are generated placeholder images, each labelled "Synthetic placeholder image"
- No Supabase, OpenAI, Resend or other backend credentials were present in the workspace. Nothing was written to any database, no email was sent and no AI model was called

## How it was captured

The real routes need a signed-in Supabase session, which this workspace does
not have. Screens were captured from a temporary local harness that mounted
the real components with synthetic props:

- `DashboardShell` + `ProjectNavBar` + `SimpleProgrammeClient` for the programme, which loads the real detailed planner when its disclosure is opened
- `DashboardShell` + `ProjectNavBar` + `ReviewSendClient` for Review and Send
- `ProposalDocumentView` + `ResponseClient` + `PublicPdfButton` for the public proposal
- The PDFs were drawn in the browser by the real `loadDocumentImages` and `renderProposalBrochure`, from snapshots built by the real `buildProposalPublicationSnapshot`

The server calls were replaced through the components' own `save`, `server`
and `respond` props with stand-ins that wait 300–700 ms and then succeed, or
fail when told to. The assistant stand-in returns fixed text. A temporary
rewrite sent `/dashboard/projects/schedule`, `/dashboard/projects/proposal`
and `/proposal/<token>` to the harness, so the real client-side navigation
from "Next: Proposal" could be followed and the phone top bar shows the real
page titles.

The harness, the rewrites, the placeholder images and the capture script were
deleted before commit and are not part of the branch.

- Build: production (`next build` + `next start`) on localhost
- Browser: headless Google Chrome driven over the DevTools protocol; real DOM clicks and input events
- The browser could resolve `localhost` only. The site's analytics scripts (`plausible.io`, `clarity.ms`) were requested by the page layout and could not load; they are listed in `capture-metrics.json`. No other host was requested
- Viewports: 1280×800 desktop, and 390×844 phone (device scale 2, touch on)
- Each screenshot shows one viewport, scrolled to the part named. Two are whole pages (`…xfull`)
- PDF pages were rendered to images with `pdftoppm` at 80 dpi. The PDFs themselves are in this folder
- `capture-metrics.json` records, for every screenshot: the URL, the viewport width, the document and page-scroller widths, the right edge of the widest visible element, any tap target under 44 px, and values read back from the page (typed inputs, totals, wording, the requests the stand-ins received). For every PDF it records the page count and the layout checks below

## What each capture shows

All screenshots exist at both sizes: `…-1280x800.jpg` and `…-390x844.jpg`.

### Programme

| File | What it shows |
| --- | --- |
| `01-programme-blank-minimum-editor` | A job with no programme: start date, how long it takes, optional stages. Status "Nothing to save yet" |
| `02-programme-start-and-duration-entered`, `02b-programme-mini-gantt-one-bar` | Start 2 November 2026 and 3 weeks typed: "Finishes Friday 20 November 2026", and the one-bar timeline. Status "Unsaved" |
| `03-programme-saving`, `03b-programme-saved` | Saving, then Saved |
| `04-programme-four-stages-editor`, `04b-programme-four-stages-mini-gantt` | Four stages in plain words (3 days, 4 days, 1 week, 3 days). The total is worked out from the stages: 3 weeks. The timeline shows each stage's dates |
| `05-programme-save-failed-inputs-kept` | A failed save: the message, "Try again", status "Failed - try again", and every stage still typed. The alert is brought into view at both sizes |
| `06-programme-retry-saved` | After Try again: Saved. Two save requests were sent with identical payloads |
| `06b-programme-leave-with-unsaved-changes-stays` | A link away with unsaved changes asks first; declining stays on the programme. The confirm text is in `capture-metrics.json` |
| `07-established-programme-opens-in-simple-view` | A previously saved three-stage programme opened as stages, status "Saved" |
| `08-detailed-programme-read-only-summary` | A programme with dependencies and overlapping stages: shown read-only with the reason, and the timeline as the proposal will state it |
| `09-detailed-planner-open` | The same programme with the detailed planner opened: the existing drag-and-drop Gantt, behind its disclosure |
| `10-programme-locked-read-only` | An accepted job: the programme is read-only with the reason, and there is no Save |
| `11-programme-dark-theme` | The programme in the dark theme |
| `12-next-proposal-arrives-on-review-and-send` | "Next: Proposal" saved the programme and opened Review and Send for the same project |

### Review and Send

| File | What it shows |
| --- | --- |
| `13-review-readiness-gaps`, `13b-review-send-blocked-until-ready` | Programme and payment stages missing: listed as needed, each with its fix. Seven recommended items listed separately as optional. Send and its confirmation box are disabled, with the reason |
| `14-review-ready-top` | A complete proposal: "Everything needed is in place" |
| `14d-review-scope-section`, `14e-review-price-section` | Scope with photographs and captions; price totals from the estimate and the payment stage editor |
| `15-ai-wording-suggestion-pending` | Suggested wording held in its own panel with Apply and Discard. The closing message is still the contractor's and the status is still "Saved" |
| `15b-ai-wording-applied-unsaved` | After Apply: the text is in the draft and the status is "Unsaved" |
| `15c-ai-suggestion-with-added-figure-dropped` | A suggestion that added "25 years": dropped, with the reason. The draft is unchanged |
| `16-review-save-failed-inputs-kept`, `16b-review-retry-saved` | A failed save keeps the typed text and offers Try again; the retry sends the same payload and saves |
| `17-preview-cover`, `17e-preview-price`, `17f-preview-programme`, `17h-preview-response` | The preview: the client's document, marked as a draft, ending with the response the client will be asked for |
| `18-send-acknowledgement-is-the-default` | Two choices, with "confirm they have received it" selected. No acceptance option. Send is disabled until the confirmation box is ticked |
| `19-sending-in-progress`, `19b-publish-refused-nothing-sent` | Sending, then a refused publication: "The proposal was not published. Nothing has been sent" |
| `20-published-email-failed-publication-stands` | Published, but the email failed: "Version 1 is published", the email failure inside it with "Try the email again", and the link to share |
| `20b-email-retry-sent-same-publication` | After the email retry: sent. One retry request for the same publication; nothing was published again |
| `21-send-non-binding-intent-chosen`, `21b-preview-shows-non-binding-intent-wording` | The non-binding choice selected, and the preview's response block changed to match |
| `21c-published-with-email-sent` | Published with the email sent. The publish request carried `responseKind: "non_binding_intent"` |
| `22-publish-outcome-unknown` | The reply to a publish was lost: reported as unknown, not as success or failure, and the confirmation box is cleared |
| `23-draft-after-send-current-version-banner` | A project with sent versions: the banner says the client sees version 3 as sent and edits stay in the draft |
| `24-sent-versions-history` | Sent versions opened: version 3 (opened, asked for a non-binding intention), version 2 (receipt confirmed), version 1 (replaced). Each can be downloaded as its own PDF |
| `25-review-dark-theme-top`, `25c-review-dark-theme-preview-stays-light`, `25d-review-dark-theme-send` | Review and Send in the dark theme. The client's document stays light |

### Public proposal

| File | What it shows |
| --- | --- |
| `26-public-acknowledgement-cover`, `-scope`, `-price`, `-programme`, `-terms` | The client's page for an acknowledgement proposal |
| `26-public-acknowledgement-response` | The response: the statement that confirming receipt is not acceptance, a name, an optional email and one button, "Confirm receipt" |
| `26b-public-response-failed-can-retry` | The response failed to record: the message, the name still typed, and the button reads "Try again: Confirm receipt" |
| `26c-public-acknowledgement-recorded` | Recorded, with the statement repeated |
| `26d-public-acknowledgement-whole-page` | The whole page, top to bottom (`1280xfull` and `390xfull`) |
| `27-public-non-binding-intent-response`, `27b-public-non-binding-intent-recorded` | The non-binding response: its statement, one button "I intend to proceed (not binding)", and the recorded state |
| `28-public-long-content-cover`, `-scope`, `-price`, `-terms`, `-response` | The oversized proposal: 70 price lines, 30 terms, 6 photographs, 3 past jobs |
| `29-historic-publication-programme-as-recorded` | A publication from before this change: its stages and day counts shown as recorded, with no finish date worked out for it |
| `29b-historic-publication-acceptance-shown-as-recorded` | The same publication, accepted at the time: shown as "Proposal accepted". No response control is offered |

### PDF

| File | What it shows |
| --- | --- |
| `30-pdf-representative.pdf`, pages 1 to 6 | The typical proposal, acknowledgement response: 6 pages |
| `31-pdf-non-binding-intent.pdf`, page 6 | The same proposal asking for a non-binding intention: the response block on the last page |
| `32-pdf-minimal.pdf`, pages 1 to 3 | One price line, one bar, one term, no photographs, no about or closing sections: 3 pages, with no page for a section that has nothing in it |
| `33-pdf-page-break-stress.pdf`, 11 of its 25 pages | The oversized proposal. Pages shown: cover, a long About section, past jobs with photographs, site photographs with captions, the price table across pages with the group name repeated, the totals with the last price line, programme and terms, closing and response |
| `34-pdf-historic-publication.pdf`, pages 1 to 5 | A publication from before this change, rendered from what it carries |

## Measured results

- Horizontal overflow: none. In all 124 screenshots the document width and the page scroller width equalled the viewport width, and no element outside its own scroller extended past the viewport. The public proposal's document width was 390 px at the phone size for the typical, non-binding, long and historic proposals
- Two parts scroll sideways inside their own strip and are measured separately as `widestRightInsideOwnScroller`: the project tab strip, and the detailed programme planner
- Tap targets: none under 44 px on the programme, on Review and Send or on the public proposal, at either size, in any capture. Tick boxes and radio buttons are measured by their whole tappable row. The public response controls measured 350×48 (name), 350×48 (email) and 350×56 (button) at the phone size, all with 16 px text
- The detailed programme planner is the existing interface. It has 22 controls under 44 px (counted as `advancedWorkspaceTargetsUnder44`) and is laid out for a wide screen; the screen says so when it is opened
- PDF, for all five documents: no item drawn outside the printable area, no heading left at the foot of a page, no empty page, no photograph separated from its caption, and the response block in one piece. Page counts: 6, 6, 3, 25 and 5. Every image was loaded; none was skipped
- The typical proposal's price reads the same in the Review and Send price section, the preview and the public page (the text of each is recorded in `capture-metrics.json`) and on page 4 of the PDF: £7,552.05 before VAT, £1,510.41 VAT at 20%, £9,062.46 including VAT. The payment stages on the public page add up to £7,552.05
- The programme reads Monday 2 November 2026 to Friday 20 November 2026, 3 weeks, on the public page (recorded), and in the preview and on page 5 of the PDF (visible in the images)

## Limits of this evidence

- The failures are simulated by the stand-ins, not by a real network, database or email fault. The real actions' failure, retry, lock and ownership behaviour is covered by unit tests against an in-memory stand-in for the database, and the response rules by `npm run test:proposal-response-sql` against the real migrations in a throwaway local Postgres. Nothing here was run against a hosted database
- The assistant's reply is fixed synthetic text. No AI model was called, so these captures say nothing about the quality of real suggestions
- No email was sent. The wording of the delivery and receipt emails is covered by unit tests only
- The public proposal was rendered by the harness from the same components and document model as the real route. The real server-rendered route (`proposal/[token]/page.tsx`) and the pages `schedule/page.tsx` and `proposal/page.tsx` were not exercised in a browser
- The photographs are local placeholder images. Loading real photographs from storage into the PDF, including what happens when one cannot be fetched, was not exercised in a browser; the renderer's handling of a missing image is covered by a unit test
- Inside the detailed planner nothing was edited, because its actions need a backend. `09` shows that it opens and renders existing phases
- The browser confirm in `06b` cannot appear in a screenshot; its text is in `capture-metrics.json`
- The measurements cover the contractor's content area and the public page. The sidebar and phone top bar are unchanged from Tranche 2A and are not measured here
- The PDF page images are 80 dpi renders for review. The PDFs in this folder are the documents themselves
- No real phone was used. 390×844 is an emulated viewport
