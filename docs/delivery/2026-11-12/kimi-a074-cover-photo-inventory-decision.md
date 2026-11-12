# A074 — Cover-photo selection: repo visual inventory and decision draft

Date: 2026-11-12 · Author: Kimi (bounded local run, branch `codex/kimi-constructa-cover-20261112`) · Type: docs-only selection input

## Scope and constraints

A074 (register: Later, "Offer an appropriate real cover photo or clearly labelled design/before-after render") is **Not started**. This document advances only the *selection* question: what existing repo visual could serve as a project cover photo, and what public-safe wording must accompany it.

Hard constraints applied (from the register note and standing direction):

- Image sourcing and AI generation are **not activated** — no external assets were fetched and nothing was generated.
- A generated design must **never be represented as completed contractor work**.
- No publication, no app-source change, no settings, no SQL. Register status is unchanged; the coordinator owns register updates.

## 1. Inventory of existing repo visuals

The repo holds 90 PNGs (41 in `public/`, 49 in `public/images/`, with heavy overlap between the two directories), plus 2 SVG icons. Fourteen files were opened and reviewed directly for this inventory; the rest are grouped by family from filename and directory role. Findings:

### A. Clean brand graphics — legible English, no people, no real client data (candidates)

| File | Content (verified by direct view) | Size |
| --- | --- | --- |
| `public/Setting us apart.png` | Dark stylised programme card: "Office Renovation / 123 Main St", Phase 1–3 timeline, "45% Complete", "Awaiting client sign-off" | 1536×1024 |
| `public/minimalist infographic cluster of small construction buildings.png` | Abstract copper line-art buildings on black; no text, no people | 2240×2240 |
| `public/Quote it Plant it deliver it.png` | Light three-step diagram: Quote it / Plan it / Deliver it with sub-captions | 1536×1024 |
| `public/Built with experience.png` | Dark app mock: "Build Proposal" panel with placeholder services ($10,000/$15,000/$3,000, total $30,000), Job One–Five, schedule strip | 1024×1024 |
| `public/image3.png` | Dark "Simplified estimating and planning": estimate card, Job Cost £17,320, signage line items | 1536×1024 |
| `public/image2.png` | Dark "SaaS for the next generation of construction firms" with budget-estimate/progress-tracking curve | 1024×1024 |
| `public/images/hero-image.png` | Dark timeline graphic "Plan, cost, and manage projects with ease" (Estimate/Proposal/Planning/Track Costs bars) | 1024×1024 |

### B. Text-overlay marketing cards — baked-in slogans (poor cover candidates)

`Build Proposal.png`, `Cost Control.png`, `Planning.png`, `Plan Cost & Manage.png`, `Quote Builder Image.png`, `Client-Ready Quote Black/White.png`, `One Tap Update*.png`, `Progress Tracker.png`, `Project Timecard*.png`, `imple/simple Project Overview*.png`, `hero-image-pricing.png`, and the `public/images/` duplicates. The marketing headline is burned into the pixels, so it competes with any project title placed over a cover. Not reviewed individually; grouped by filename and directory role.

### C. AI-generated UI mock-ups with garbled text — public-safety risk (do not use for covers)

Verified by direct view: `plan-it.png`, `quote-it.png`, `track-it.png`, `deliver-it.png`, `Dashboard Programme at a Glance.png`. All contain nonsense words ("Comima Cardeitisc", "Borckoll denages Mellads") visible at full resolution. A client or inspector zooming in would see gibberish — these must never appear in a proposal, case study, or cover, labelled or not.

### D. AI-generated people imagery — misrepresentation risk (do not use for covers)

Verified: `public/images/about-hero.png` — three people in hard hats around a laptop. Already used on `/about` as a generic hero. Generated faces could be read as real staff or clients; unsuitable as a project cover without explicit "AI-generated" labelling, which a cover photo should not need.

### E. Exact duplicates (housekeeping note)

- `public/images/hero-image.png` and `public/image1.png` are **byte-identical** (SHA-256 `774a160e3a4ca0f3…`, verified). One copy is redundant.
- `public/images/` substantially duplicates `public/` root (e.g. the `One Tap Update` family, `Quote Builder Image.png`). Consolidation is a separate cleanup decision and was **not** done here.

## 2. Assessment against A074

- **No real photograph of contractor work exists in the repo.** The "real cover photo" half of A074 cannot be satisfied offline; sourcing or generating one is not activated.
- The honest, available path is the other half of A074: a **clearly labelled design render**. Requirements applied: legible text, no people, no real client names/addresses, on-brand dark charcoal style, and mandatory "not a photograph" labelling.

## 3. Decision draft — representative project

Representative project: **"Office Renovation — 123 Main St"**, matching the placeholder programme card already in the repo (obvious placeholder address, no real client).

**Primary pick: `public/Setting us apart.png`**

- On-brand dark render of a programme board for exactly this kind of project; all text legible; no people; the address is an evident placeholder.
- Mandatory caption where used: **"Illustrative design render — not a photograph of completed work."**
- Suggested alt text: "Illustrative render of a project programme board for an office renovation."

**Fallback: `public/minimalist infographic cluster of small construction buildings.png`**

- Use when the cover must not imply any specific project state (e.g. early-stage or generic templates). No text to clash with project titling.
- Mandatory caption: **"Illustrative artwork — not a photograph of completed work."**

**Explicitly rejected for covers:** all of group C (garbled AI text), group D (generated people), `hero-image.png`/`image1.png` (marketing headline burned in, plus the byte-duplicate), and group B cards (baked-in slogans).

## 4. Public-safety rules for any later wiring

1. The caption above ships with the asset wherever it is used (proposal cover, case study, marketing page); no exceptions.
2. Never pair the render with a real client name, real address, or text implying completed work.
3. No new external assets, no AI generation, no publication without Rob's explicit approval.
4. A074 remains **Not started** in the register until Rob approves this selection and the separate wiring work is authorised and evidenced.

## 5. Verification performed (offline, this change)

- `gitleaks dir` scan of this new document: **0 findings**.
- Duplicate claim verified: `shasum -a 256` of `public/images/hero-image.png` and `public/image1.png` match exactly.
- No builds, no test suites, no installs — docs-only change, consistent with the run's "no builds" bound.

## Open questions for Rob

1. Approve the primary pick (`Setting us apart.png`) and fallback, and the exact caption wording?
2. Is real-photo sourcing (the full A074 scope) something to activate later, or is the clearly-labelled-render direction the accepted end state?
