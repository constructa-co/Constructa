# D110 — Customer copy review sheet (PRIVATE · UNPUBLISHED)

**Owner:** Rob · **Grader:** R1 · **Not for public routes or live copy edits**

This sheet indexes **existing repository assets** only. It does not add articles, metrics, privacy/legal/pricing claims, or activation steps. Publication, Kit/forms, and measurement remain **held** per delivery inbox (#227, #228, signup, etc.).

## What already ships (cite before editing)

| Register | Asset paths | Status for this batch |
| --- | --- | --- |
| **A102** | `docs/marketing/drafts/linkedin-saved-job-data-2026-11-24.md`, `facebook-programme-check-2026-11-24.md`, `medium-brief-to-proposal-2026-11-24.md`; older pack `docs/delivery/2026-11-13/kimi-a102-social-drafts.md` | Adequate **UNPUBLISHED** drafts — manual post only |
| **A103** | `docs/marketing/drafts/estimate-review-pilot-article-2026-11-24.md`, `programme-review-pilot-article-2026-11-24.md`, plan `docs/marketing/drafts/pilot-review-plan-2026-11-24.md`; charter `docs/marketing/contractor-guide-pilot.md` | Adequate pilot prose + review plan — no traffic data (nothing posted) |
| **A101** | Live preview (forms OFF): `src/components/marketing/newsletter-signup.tsx` (`showNewsletterPreview` branch); gated form unchanged when `CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED=1` | **Partial** — provider/live verify owner-held; preview note merged via **#267/#268** |

**URL policy (unchanged):** Prefer `constructa-nu.vercel.app/guides/...` for review links; treat `www.constructa.co` as intended canonical **unverified** until domain handoff (see `pilot-review-plan-2026-11-24.md`).

## Rob decisions (check one per row — no worker inference)

| # | Decision | Options | Notes |
| --- | --- | --- | --- |
| 1 | Approve any **A102** draft for manual posting? | Approve one / Revise / Hold | Do not schedule or send from this repo |
| 2 | Approve **A103** pilot articles for a future publish step? | Approve / Revise / Hold | Measurement stays N/A until owner posts |
| 3 | **A101** preview wording on `main` | Keep current / Pick alt below / Revise later | Alts are for review only — not applied in this batch |
| 4 | Kit enablement | Hold (default) / Separate owner pass | Flag + provider + `#228` — not D110 |

## A101 — current preview copy on `main` (forms OFF)

From `NewsletterSignup` when preview note shows:

- Eyebrow: **Optional updates**
- Heading: **Constructa updates**
- Body: “Product news for construction businesses. Email updates are not available yet in this preview.”
- CTA: link to **`/guides`** — “Browse the guides … for practical walkthroughs you can use now.”

## A101 — plain wording alternatives (Rob review only)

Pick at most one direction if you later authorise a source change. Wording avoids Kit, consent, pricing, and list growth promises.

### Alternative A — shorter

- Eyebrow: Optional updates  
- Body: “We have not turned on email updates in this preview yet.”  
- CTA: “Read the guides for walkthroughs that work with a review account.”

### Alternative B — same intent, softer tone

- Eyebrow: Stay in the loop (later)  
- Body: “Constructa can send occasional product news by email when this list is enabled. It is off in this preview.”  
- CTA: “Use the guides in the meantime — they mirror what reviewers see in the app.”

### Alternative C — minimal (guides-first)

- Eyebrow: *(none)*  
- Heading: Constructa updates  
- Body: “Email updates are turned off here.”  
- CTA: Single link: “Open the guides hub.”

**If all three are unwanted:** keep `main` copy; no further copy asset required.

## Explicitly out of scope

- New public routes, `src/components/marketing/*` edits, analytics, Resend/social APIs, form submission, or provider activation  
- Duplicate articles or new “status” reports  
- Claiming A102/A103 **Complete** without owner publication evidence