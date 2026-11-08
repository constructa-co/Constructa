# A001 — Marketing brand consistency audit (charcoal-and-green + tone)

**DRAFT — ROB REVIEW REQUIRED.** Report only; no source edits were made.
Audited 2026-11-08 from branch `kimi/marketing-drafts-20261108-1020` @ be246b3, read-only.

## Method

- Established the canonical palette from `src/components/marketing/phase-one.module.css:2-8`:
  `--ink #f4f2ed`, `--muted #a7b0a9`, `--base #101211` (charcoal), `--panel #191f1b`,
  `--line #343e36`, `--accent #c9efcf` (light green), `--accent-ink #182c1b`.
- Confirmed the same token set is duplicated in `src/components/marketing/cohort-contact.module.css:2-8`
  and that `src/components/marketing/guides.module.css` (`:15`, `:19`, `:90`, `:99`),
  `home-business-visual.module.css`, `product-screenshots.module.css` and
  `product-review-guide.module.css` use the same colour family (`#151a16`, `#526455`, `#c0cdc3`).
- Grep-scanned all marketing TSX/CSS for non-brand colour literals and sampled headings/body copy.
- Gating context: `src/app/page.tsx:6` (and the matching `features`/`product`/`pricing`/`landing` pages)
  render the `full-*` components only when `getLaunchProfile() === 'full'`
  (`src/lib/launch-profile.ts:48-52`); the default is `cohort`, which renders the
  charcoal-green phase-one/cohort components. **The findings below therefore affect the
  `full` launch profile only** — but those pages ship the moment the profile is switched,
  so they are not dead code.

## Finding 1 — `full-features.tsx` is blue/purple, not charcoal-and-green (high severity)

`/features` in the full profile. Blue and purple accents throughout, against a pure-black base:

- `full-features.tsx:23` — root `bg-black text-white selection:bg-blue-500/30`
- `full-features.tsx:26` — hero wash `bg-gradient-to-b from-blue-600/5`
- `full-features.tsx:29` — badge dot `bg-blue-500 animate-pulse`
- `full-features.tsx:34` — hero gradient headline `from-blue-400 to-blue-600` ("Built for momentum.")
- `full-features.tsx:47` — "Part 01 — Quoting" kicker `text-blue-500`; glow `:65`, item dots `:78-79`
- `full-features.tsx:148` — "Part 03 — Tracking" kicker `text-purple-500`; glow `:166`, dots `:179-180`
- `full-features.tsx:199` — "Part 04 — Delivery" kicker `text-blue-400`; dots `:218-219`, glow `:238`
- `full-features.tsx:248` — closing CTA `text-blue-500` ("Win more work.")

Suggested fix: recolour all `blue-400/500/600` and `purple-500` literals to the brand accent family
(e.g. the sage tones already used in `phase-one.module.css` — `#c9efcf` accent, `#96b79b` mid-sage,
`#729478`/`#6e8c74` deep sage), and move the base from pure `bg-black` to the charcoal `#101211`.
No structural change needed; it is a class-token swap plus one root background.

## Finding 2 — Stray blue overlay on the home contact card (low severity, clear bug)

- `full-home.tsx:696` — `bg-blue-500/5 mix-blend-overlay` hover overlay on the contact form card,
  inside an otherwise black/white/gray section.

Suggested fix: remove it or replace with a brand-tinted overlay (`#35563b`-family, as used at
`phase-one.module.css:91`).

## Finding 3 — The whole `full-*` family is black/white/gray, not charcoal-and-green (high severity)

The full-profile pages use generic Tailwind neutrals and pure white pill CTAs, a different visual
language from the warm-charcoal phase-one family:

- `full-home.tsx` — body copy `text-gray-400` (e.g. `:143`, `:240`, `:274`, `:320`, `:352`, `:624`);
  section washes `from-black via-gray-900/50 to-black` (`:227`, `:259`, `:305`, `:348`, `:581`);
  CTAs are `rounded-full bg-white text-black font-black uppercase tracking-widest`
  (`:151`, `:246`, `:286`, `:332`, `:428`, `:637`) vs the phase-one 7px-radius sage-filled
  `.primary` button (`phase-one.module.css:32-33`).
- `full-landing.tsx` — same black/white/gray treatment (71 className lines; e.g. headings
  `text-white` at `:83-101`).
- `full-pricing.tsx` — `bg-zinc-800`/`text-green-400` billing toggle (`:115-117`), card panels
  `border-gray-800/50 bg-black/50` (`:127`, `:154`, `:211`), comparison table `border-zinc-700`
  (`:261`), washes `from-black via-gray-900/50` (`:356`).
- `full-product.tsx` — `text-gray-400` body copy (`:8`, `:15`, `:22`, `:29`).

Suggested fix: either (a) restyle the four components onto the phase-one CSS-module tokens
(charcoal `#101211` base, warm ink `#f4f2ed`, sage `#c9efcf` accent, 7px radii, Avenir Next stack),
or (b) if the full profile is meant to keep its own look, at minimum warm the neutrals toward the
charcoal family and replace the pure-white pills with the brand primary button. Option (a) gives
one brand across both profiles; it is also the smaller long-term surface (one module vs
scattered literals).

## Finding 4 — Typography is inconsistent between the two families (medium severity)

- Phase-one family declares the brand stack: `phase-one.module.css:10`
  (`"Avenir Next", "Gill Sans", "Trebuchet MS"`) plus a Georgia serif for the paper visual
  (`phase-one.module.css:46`).
- `src/app/globals.css` contains no `font-family` rule (verified by grep), so the `full-*` pages
  render in the browser/Next default sans — not the brand font — and use `font-black uppercase
  tracking-widest` display styling with no equivalent in the phase-one pages.

Suggested fix: with Finding 3, set the full pages on the same stack; otherwise declare a shared
font stack in `globals.css`.

## Finding 5 — Tone: hype SaaS voice on `full-*` vs grounded trade voice on phase-one (medium severity)

Phase-one copy is short, concrete and trade-grounded: "Good work." (`phase-one.tsx:122`),
"The work-winning essentials." (`:92`), "A kitchen." (`:59`), "Less starting again." (`:78`).
The full pages use generic momentum/hype register:

- `full-features.tsx:34` — "Built for momentum."
- `full-features.tsx:248` — "Save hours. Win more work. Stay in control."
- `full-landing.tsx:188` — "No more spreadsheets. Just smart tools for your construction company."
- `full-landing.tsx:95` — "One-tap updates"; `:101` — "Built-in cost control"
- `full-features.tsx` ~`:82` — "Engagement Tracking — Get notified when clients open proposals"

Suggested fix: rewrite full-page headlines/lede paragraphs into the phase-one register
(noun-led, specific, no exhortation). Two caution flags for whoever edits: (1) "One-tap updates"
and "minutes" claims should be checked against actual shipped behaviour before reuse;
(2) the engagement-notification claim needs verification against shipped proposal features —
**unverified here**; do not carry it into cohort-facing copy until confirmed.

## Finding 6 — Brand-consistent surfaces (no action)

`phase-one.tsx` + `phase-one.module.css`, `cohort-contact.tsx` + `.module.css`, `guides-hub.tsx`,
`guide-article-view.tsx`, `home-business-visual`, `product-screenshots`, `product-review-guide`
all share the charcoal-and-green tokens and the measured tone. `readability.test.ts` pins contrast
against the canonical colours, and `phase-one-responsive.test.ts:90` pins `--accent: #c9efcf`,
so the cohort-facing marketing is self-consistent today.

## Suggested priority order

1. Finding 1 (blue/purple on `/features`) — most visibly off-brand.
2. Finding 3 + 4 (full-family restyle onto brand tokens/font).
3. Finding 5 (tone pass on full pages, with the two verification flags).
4. Finding 2 (one-line overlay removal).

No tests were run (read-only audit; no source changes). All line numbers are from be246b3.
