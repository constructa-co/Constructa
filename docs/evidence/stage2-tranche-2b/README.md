# Stage 2 Tranche 2B — evidence

- Baseline: `dd6e2492d1c4407cd1ef3995ccd1a1fb7241886e`
- Branch: `claude/stage2-tranche-2b-first-session`
- Captured: 3 October 2026, from the code in the commit that adds this folder

## Data and identity

Synthetic data only. No real customer data, credentials or secrets were used.

- Contractor: `contractor@example.test`, business "Example Plumbing", user "Sam Example"
- New project: "14 Example Road bathroom refit" for client "Alex Client"
- Established-user projects: "Example Extension" (Alex Client), "Sample Bathroom Refit" (Sam Sample)
- No Supabase or other backend credentials were present in the workspace. Nothing was written to any database.

## How it was captured

The real routes need a signed-in Supabase session, which this workspace does
not have. Screens were captured from a temporary local harness that mounted
the real components with synthetic props:

- `OnboardingFrame` + `OnboardingClient` for setup
- `DashboardShell` + `DashboardClient` (Pipeline), `HomeClient` (Home), `NewProjectForm`, and `ProjectNavBar` + `BriefClient` for the dashboard screens

The two save calls were replaced through the components' `saveStep` and
`createProject` props with stand-ins that wait 400 ms and then either succeed
or fail once, so failure, retry and success could all be shown. A temporary
rewrite sent `/dashboard/projects/new` and `/dashboard/projects/brief` to the
harness so the real client-side navigation could be followed end to end.

The harness, the rewrite and the capture script were deleted before commit
and are not part of the branch.

- Build: production (`next build` + `next start`) on localhost
- Browser: headless Google Chrome driven over the DevTools protocol; real DOM clicks and input events
- Viewports: 1280×800 desktop, and 390×844 phone (device scale 2, touch on)
- `capture-metrics.json` records, for every screenshot, the final URL, the viewport width, the document scroll width, the right edge of the widest visible element, any tap target under 44 px, and values read from the page

## Files

Each state has a `-1280x800.jpg` and a `-390x844.jpg` version.

| File | Shows |
| --- | --- |
| `01-onboarding-step1-trade` | Setup step 1 of 2, outside the dashboard shell, with a trade chosen |
| `02-onboarding-save-failed` | The first save fails: message shown, button reads "Try again", choice kept |
| `03-onboarding-saving` | Saving state: button disabled with spinner |
| `04-onboarding-retry-saved-step2` | After "Try again" the trade is saved ("Saved: Plumbing & Heating") and step 2 is shown. The page recorded one saved step: `{"step":"trade","businessType":"Plumbing & Heating"}` |
| `05-onboarding-missing-name` | Finishing with no business name: plain message, nothing sent |
| `06-onboarding-finish-lands-on-new-project` | Finishing setup with no projects arrives at `/dashboard/projects/new` |
| `07-zero-project-pipeline` | Pipeline (the cohort landing page) with no projects: one action and the four-step journey, no KPI cards |
| `08-zero-project-home` | Home (full profile) with no projects: the same single action |
| `09-new-project-blank` | Blank New Project form: job name and client name only |
| `10-new-project-required-missing` | Creating with nothing typed: field messages, no request sent |
| `11-new-project-optional-details` | Optional details opened |
| `12-new-project-create-failed-inputs-kept` | Create fails: message shown, button reads "Try again". The inputs read back as "14 Example Road bathroom refit" and "Alex Client" |
| `13-retry-arrives-at-named-brief` | "Try again" succeeds and arrives at `/dashboard/projects/brief?projectId=synthetic-project-1` with the project's name. Both attempts sent the same request id (see `capture-metrics.json`) |
| `13b-arrives-at-named-brief-dark-theme` | The same arrival with the dark theme selected, without a failure first |
| `14-established-pipeline-no-quick-quote` | Pipeline with projects: KPI cards and board as before, one "New Project" button. Page text contained no "Quick Quote" |
| `15-established-home-no-quick-quote` | Home with projects: as before, without Quick Quote. Page text contained no "Quick Quote" |

## Measured results

- No screenshot had horizontal overflow: document scroll width equalled the viewport width in all 32 captures.
- No tap target under 44 px in files 01–12 (setup, zero-project Home/Pipeline, New Project).

## Limits of this evidence

- The failures are simulated by the stand-in save calls, not by a real network or database fault. The real actions' failure, retry and idempotency behaviour is covered by unit tests against a fake Supabase client, not against a database.
- The Brief in 13 and 13b is the real `BriefClient` given a synthetic project with the name and client that were typed. It was not loaded from a database.
- In 13 the Brief is hard to read in the default light theme: its headings are white on a light background. That is how the existing Brief page renders in that theme at the baseline; this tranche did not change the Brief. 13b shows the same page in the dark theme.
- Because the harness paths are not Phase 1 routes, the phone top bar in 07–12 shows the fallback title "Constructa" rather than the page name.
- Files 14 and 15 have tap targets under 44 px. Those screens are unchanged apart from the removed Quick Quote buttons.
- The server-side redirect at the end of setup, the `/dashboard/projects/quick-quote` redirect and the proxy's onboarding gate were not exercised in a browser. The first two are covered by unit tests.
