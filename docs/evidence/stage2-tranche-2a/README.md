# Stage 2 Tranche 2A — evidence

- Code commit: `af5dcd1c3585ae10cd10353270063973dc8d6a73`
- Baseline: `476f4c2dae75747fc558ae4211d96190c476f647`
- Branch: `claude/stage2-tranche-2a-foundations`
- Captured: 3 October 2026

## Data and identity

Synthetic data only. No real customer data, credentials or secrets were used.

- Identity type: synthetic contractor `contractor@example.test`, company "Example Plumbing"
- Projects: "Example Extension" (client "Alex Client"), "Sample Bathroom Refit" (client "Sam Sample")
- No Supabase or other backend credentials were present in the workspace.

## How it was captured

The dashboard routes need a signed-in Supabase session, which this workspace
does not have. Screens were captured from a temporary local harness that
mounted the real `DashboardShell`, `SidebarNav` and proposal `ClientEditor`
components with synthetic props. The harness was deleted before commit and is
not part of the branch.

- Harness routes: `/dashboard-evidence/shell` and
  `/dashboard-evidence/proposal?mode=incomplete|complete` on localhost
- Real routes these stand in for: `/dashboard` and `/dashboard/projects/proposal`
- Because the harness path is not a Phase 1 route, the phone top bar shows the
  fallback title "Constructa" rather than the page name.
- Screenshots 01–04 and 07 are from `next dev`; 05, 06, 08 and 09 are from a
  production build (`next build` + `next start`).

## Files

| File | Route (harness) | Viewport | Shows |
| --- | --- | --- | --- |
| `01-desktop-shell-1280x800.jpg` | `/dashboard-evidence/shell` | 1280×800 | Desktop sidebar and content offset unchanged |
| `02-phone-shell-390x844.jpg` | `/dashboard-evidence/shell` | 390×844 | Phone top bar, full-width content, no 256px offset |
| `03-phone-menu-open-390x844.jpg` | `/dashboard-evidence/shell` | 390×844 | Phone menu open with all eight Phase 1 destinations |
| `04-phone-menu-project-selected-390x844.jpg` | `/dashboard-evidence/shell` | 390×844 | Active project chosen; Brief, Estimates, Programmes and Proposals links carried `?projectId=` |
| `05-desktop-proposal-incomplete-blocked-1280x800.jpg` | `/dashboard-evidence/proposal?mode=incomplete` | 1280×800 | "Ready to send?" with five unresolved items |
| `06-phone-proposal-incomplete-blocked-390x844.jpg` | `/dashboard-evidence/proposal?mode=incomplete` | 390×844 | Unresolved items, fix links and "Can't send yet. Finish 5 items above before you send." Both publish buttons were disabled |
| `07-save-failed-retry-publish-blocked-390x844.jpg` | `/dashboard-evidence/proposal?mode=incomplete` | 390×844 | Failed save with Retry save, and publication blocked for that reason |
| `08-phone-payment-row-scrolls-390x844.jpg` | `/dashboard-evidence/proposal?mode=incomplete` | 390×844 | Payment row scrolls sideways inside its card instead of clipping |
| `09-phone-proposal-ready-390x844.jpg` | `/dashboard-evidence/proposal?mode=complete` | 390×844 | All six mandatory items met; publish buttons enabled |
| `10-sparse-profile-proposal-sections.pdf` | n/a (generated in Vitest) | A4 | About Us, Introduction and Closing sections for a profile with only a company name and capability statement |
| `10-sparse-profile-proposal-sections.txt` | n/a | n/a | Every string drawn into that PDF |

## Limits of this evidence

- The save failure in 07 is real but comes from the harness having no backend:
  `saveProposalAction` threw because no Supabase credentials exist. A
  successful retry could not be shown for the same reason. The retry button
  calls the existing `handleSave`, and the gate logic is covered by unit tests.
- File 10 renders three section builders directly, not the whole proposal, so
  its page and section numbers differ from a full proposal.
- Brief, Estimates, Programme, Pipeline, Profile and Case Studies pages were
  not rendered at phone width: they need an authenticated session. Only the
  shell, the phone menu and the proposal editor were checked visually.
