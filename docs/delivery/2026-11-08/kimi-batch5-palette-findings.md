# Kimi batch 5 — palette consistency findings (marketing + brand-adjacent surfaces)

**DRAFT — ROB REVIEW REQUIRED.** Findings only; no source edits (Cursor owns the
`full-*` fixes; A001 findings are unchanged and restated here only as a verified
baseline, not repeated work).

Checked 2026-11-08 from `kimi/marketing-drafts-20261108-1020` @ 4901eb5, read-only.
Canonical palette: charcoal-and-green tokens at `phase-one.module.css:2-8`
(`#101211` base, `#f4f2ed` ink, `#c9efcf` accent, sage mid-tones).

## 1. Verification of batch-3 A001 findings at current head (no new work)

`git diff --stat be246b3..HEAD -- src/` is empty (only docs commits since), so the
A001 audit (`docs/delivery/2026-11-08/kimi-a001-brand-audit.md`) still applies
verbatim at 4901eb5. Spot-verified line numbers: `full-features.tsx:29`
(`bg-blue-500` badge dot), `full-features.tsx:148` (`text-purple-500` kicker),
`full-home.tsx:696` (`bg-blue-500/5` overlay) all match. A001 remains the authority
for: blue/purple across `full-features.tsx`, the stray blue overlay in
`full-home.tsx`, the black/white/gray `full-*` family, typography and tone.
Nothing below re-opens those.

## 2. New findings — brand-adjacent app pages A001 did not audit

These are app routes outside `src/components/marketing/` that a visitor hits from
marketing nav (footer links to Terms/Privacy at `phase-one.tsx:39`; About, login).
All are generic Tailwind black/white/gray — the same off-brand family as A001
Finding 3 — so they would stay off-brand even after a `full-*` recolour.

### 2.1 `/about` is pure black/white/gray with blue links (off-brand)

`src/app/about/page.tsx`:

- `:43` — root `<div className="bg-black text-white">`
- `:55,58,61,71,80,96,105,113,116,129,152,155,158` — body copy `text-gray-300` /
  `text-gray-400` throughout
- `:172` — footer section `bg-black text-white py-16 border-t border-gray-700`
- `:175` — footer grid `text-sm text-gray-300`
- `:178,182` — social links `text-blue-400 underline` (medium.com, linkedin.com);
  `:186` repeats the pattern for constructa.co

### 2.2 `/terms-of-service` is black/white/gray (off-brand)

`src/app/terms-of-service/page.tsx`:

- `:3` — `<main className="min-h-screen pt-16 bg-black">`
- `:5` — heading `text-4xl font-bold text-white`
- `:9-11` — body paragraphs `text-gray-400` (repeated through the page)
- `:26-28` — contact link `text-gray-300 hover:text-white`

### 2.3 `/privacy-policy` is black/white/gray with an amber warning block (mostly intentional)

`src/app/privacy-policy/page.tsx`:

- `:3` — `<main className="min-h-screen pt-16 bg-black">`
- `:5` — heading `text-white`; `:22-45` — body `text-gray-400` / `text-gray-500`
- `:10-16` — draft-status notice `border-amber-500/40 bg-amber-950/30` with
  `text-amber-200`/`text-amber-100/90`. Amber is outside the brand palette, but it
  is a deliberate warning semantic ("Draft, not yet legally approved"), so this is a
  **recorded exception, not a defect** — worth a conscious decision rather than an
  automatic recolour.

### 2.4 Login page — two stray gray spans on an otherwise on-brand page (minor)

`src/app/login/page.tsx:292,299` — `Already have an account?` / `Don't have an
account?` helper text uses `text-gray-400`, while the rest of the page renders
through `first-session.module.css`, which is charcoal-and-green
(`--session-base: #101211`, `--session-accent: #c9efcf`). Two-class fix.

## 3. Surfaces confirmed on-brand

- All hex literals in `src/components/marketing/*.module.css` and
  `src/app/globals.css` are charcoal/green/cream family (scan of
  `#rgb|#rrggbb|rgb(|hsl(` literals; no stray hues).
- `phase-one`, `cohort-contact`, `guides-hub`, `guide-article-view`,
  `home-business-visual`, `product-screenshots`, `product-review-guide` — matches
  A001 Finding 6, re-confirmed.
- `src/components/first-session.module.css` (login/first-session shell) uses the
  same token family.

## 4. Notes

- Scope kept read-only per batch 5 instructions; fixes are Cursor's on the RC
  branch. Findings 2.1–2.3 are on main-line app routes (not RC-owned), so whoever
  owns non-RC palette work should pick them up separately.
- No tests run (read-only grep/sed inspection; `src/` unchanged since be246b3
  verified by `git diff --stat`).
