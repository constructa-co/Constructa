# Kimi marketing drafts — A084 copy/imagery review + A102 social drafts

**Status: DRAFT — ROB REVIEW REQUIRED. Nothing here is approved for publication, posting, purchase or settings change.**
Author: Kimi (offline pass, 2026-11-08). Source/offline review only — no hosted rendering, no browser screenshots verified by a human, no publication.

## Source reviewed (offline, current branch kimi/marketing-drafts-20261108-1020)

- `src/app/landing/page.tsx` → `src/components/marketing/full-landing.tsx`
- `src/components/marketing/full-features.tsx`, `full-pricing.tsx`, `full-product.tsx`
- `src/app/about/page.tsx` (stats section)
- `public/images/` filenames (not pixel-inspected — see labelling note below)

---

## A084 — Marketing copy & imagery recommendations

**DRAFT — ROB REVIEW REQUIRED**

### Current copy observed
- Hero: "No more spreadsheets. Just smart tools for your construction company."
- Four pillars: "Fast, accurate proposals" / "Simple project planning" / "One-tap updates" / "Built-in cost control"
- Sections: "What Sets Us Apart", "Why Choose Constructa" ("Built for small teams", "Simple setup, no training needed", "No lock-in contracts"), "What is Constructa?"
- CTA: "Get Started with Constructa"; secondary "Have questions?" (contact)
- Pricing tiers: Basic / Standard / Professional / Enterprise
- About-page stats: "1M+ small construction firms", "60% lose time to admin weekly", "80% still use spreadsheets"

### Concise recommendations (copy)
1. **Lead with the outcome, not the tool.** Keep "No more spreadsheets" but pair the hero with one concrete result, e.g. "…so a quote goes out the same day the client asks." — grounded in the existing "Fast, accurate proposals" pillar; no new capability claimed.
2. **Name the audience explicitly.** "Built for small teams" is buried mid-page; a small-trades qualifier ("for small construction firms and trade contractors") early improves relevance and matches the About-page framing.
3. **De-jargon "One-tap updates".** In copy, say what it updates (client-facing progress/quote status) — the phrase alone doesn't tell a trade buyer what they get.
4. **Add one honest qualifier to pricing-adjacent copy.** "No lock-in contracts" is good; consider "no credit card to look around" style wording only if it is actually true of current sign-up — verify before use, otherwise leave as is.
5. **Stats need sources.** The About stats (1M+, 60%, 80%) carry no citation visible in source; either add a source line or soften to "industry estimates". Do not publish unreferenced figures.
6. **Tighten duplicated section intent.** "What Sets Us Apart" and "Why Choose Constructa" overlap; merge into one comparison block to shorten the page.

### Imagery recommendations
- The `public/images/` set is consistent and on-theme (proposals, planning, cost control, one-tap update, dashboards), but is a mix of **product-UI PNGs and stylised "Black/White" illustration variants**. Recommendation: on each pillar section, prefer the UI screenshot that literally shows the feature named in the heading; keep the stylised variants only as decorative hero/backdrop images.
- **Honest labelling (required):** label any image that is a design render/mock-up as such ("Illustration" or "Product preview"), and label real UI captures as actual product screenshots. Never present a mock-up as a live product capture. This aligns with A074 imagery rules.
- Filenames contain spaces and inconsistent casing (e.g. `Client-Ready Quote Blackpng.png`, `Project TImeline.png`). Recommend a later cleanup pass (rename to kebab-case) — file rename only, no content change; needs care to update references.
- Alt text exists on key images (e.g. alt="Proposals", alt="Planning") but is generic; make alt text describe what the buyer sees ("Quote being built in the proposal editor").

---

## A102 — Social draft posts

**DRAFT — ROB REVIEW REQUIRED. Not posted, not scheduled, no links published.**
Each post links only to existing site routes; confirm the final URL/UTM plan before any later posting.

### LinkedIn (draft 1 — problem → outcome)
> Spreadsheets run a lot of small construction firms — and eat the evenings that should go to the job.
>
> Constructa is built for small teams: quotes, programme, cost control and client updates in one place, with no training overhead and no lock-in.
>
> (Preview remains invite-only — message us if you'd like to see it.)

### Facebook (draft 2 — plain-language, trades audience)
> Still pricing jobs in spreadsheets and chasing updates by text?
>
> Constructa helps small construction firms send fast, accurate quotes, keep the programme in one view, and give clients one-tap progress updates. No training needed, no lock-in contracts.
>
> Early access is by invitation — drop us a message if you'd like a look.

### Medium (optional draft 3 — longer-form angle)
> **Why 80% of small construction firms still run on spreadsheets — and what it costs them**
>
> Roughly 60% of small-firm owners lose time to admin every week. The tool they reach for is the same one that creates the problem: the spreadsheet. It doesn't send the quote, it doesn't update the client, and it quietly drifts out of date.
>
> We built Constructa around the things trades actually do every week: build a quote fast, plan the job simply, keep costs visible, and update the client without a phone call. Small teams, simple setup, no lock-in.
>
> *(Draft for review — figures should carry a source per the A084 notes before publication.)*

---

## Honesty & scope notes
- All copy above is grounded only in text found in the current source; no capability was invented and no launch date, price or availability promise was added.
- "Early access by invitation / preview" reflects the current invite/preview state (preview HOLD per inbox). If that changes, update the drafts.
- Image assessment is filename/source-level only; no pixel inspection was done in this pass. Render-vs-screenshot labelling must be verified visually before any asset is used in a post.
- No publication, posting, purchase, provider or settings action was taken or requested.
