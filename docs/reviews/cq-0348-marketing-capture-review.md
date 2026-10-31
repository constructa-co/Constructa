# PASS — cq-0348 independent Kimi source review of Claude marketing capture imagery

## Verdict

PASS. Independent source/static-only review of the imagery job (Claude, cq-0338-marketing-captures / cq-0344-marketing-phone-captures). No required findings. The source is a coherent, honestly qualified implementation of the Rob 01 Nov 03:10 imagery task and matches every acceptance point I was asked to check.

## Reviewed pins and path scope

- Base reviewed: `09aeb5067c5b9943ec54d6644c6ac3323f8f05c4` (accepted ROOT, my branch `cq/cq-0348-marketing-capture-review` HEAD — I did not review my own unchanged HEAD as the target).
- Target: `1250d1bde742008236bc0b4053486627d9ac2d60`, verified normal child of `4adfad9d37641e9a4e81e7e9cc234576cd8d9d53`, itself verified normal child of `09aeb50`.
- Net range reviewed: `09aeb50..1250d1b` — exactly two commits (`4adfad9`, `1250d1b`).
- Net changed paths: only `docs/reviews/cq-0338-marketing-captures.md`, `docs/reviews/cq-0344-marketing-phone-captures.md` (builder's own review docs, not graded), and the four in-scope code/test paths:
  - `src/components/marketing/phase-one.tsx` — diff is exactly two hunks: one added import (`ProductScreenshots`) and one insertion of `<ProductScreenshots />` inside `PhaseOneFeatures` between `<ProductReviewGuide />` and `<Scope />`. Nothing else in the file changed.
  - `src/components/marketing/product-screenshots.tsx` (new)
  - `src/components/marketing/product-screenshots.module.css` (new)
  - `src/components/marketing/product-screenshots.test.tsx` (new)
- No marketing full-variant, Home, Pricing, sidebar or `src/app` writes anywhere in the net diff (`git diff --name-status` confirms the six paths above are the complete set).

## What I verified against the target blobs

Read exact blobs via `git show 1250d1b:<path>` (not the working tree). Cross-check: all four target blob hashes (`phase-one.tsx` fd9c370, `product-screenshots.tsx` 736c2bcc, `.module.css` 5545e92f, `.test.tsx` fe9cf3f9) match the released sibling terminal/frozen worktree `.cq-wt/cq-0431-a038-upload-outcomes` exactly.

**Image mechanics**
- Static imports of the four existing committed evidence JPGs; no copies, no `public/` or remote URLs (test enforces this, and I verified the imports resolve to committed tracked files).
- Git blob SHA-1s of the four assets at `1250d1b` match the hashes asserted in the test exactly: `2c3e96d8…` (2C desktop), `9cba2799…` (2C phone), `bf1fdf66…` (2D desktop), `be2f5de8…` (2D phone).
- Pixel dims spot-checked with `sips`: desktop JPGs 1280×800; phone JPGs 780×1688 actual (390×844 logical at device scale 2) — consistent with the stated `width: 780, height: 1688` phone props and `width: 1280, height: 800` desktop props.
- Repair uses `getImageProps` + `<picture>` + a single `<source media="(max-width: 600px)" srcSet={phone} sizes="88vw" width={780} height={1688}>` + a desktop `<img>` fallback carrying the desktop `srcSet`/`sizes` — the phone capture is chosen by a declarative narrow source instead of shrinking the desktop figures.
- Lazy loading: the fallback `img` renders `loading="lazy"` (getImageProps default for non-priority); no priority/preload added.
- Sizing: figure `max-width: 1280px`, desktop `sizes '(max-width: 1422px) 100vw, 1280px'`, `img { width: 100%; height: auto }` with intrinsic width/height attributes — aspect ratio preserved; no `object-fit`/`aspect-ratio` hacks in the CSS.

**Qualifications and accuracy (independently re-inspected all four images, not just the parent's inspection)**
- I viewed all four JPGs from the target blobs. Contents match the READMEs and the component copy:
  - 2C estimate desktop crop shows Risk/Profit/Discount percentage fields, discount-reason field, the "Not saved yet … total before VAT would be £14,395.70" note and a blue **Save adjustments** button.
  - 2C phone crop shows Profit, Discount, discount-reason, the not-saved-yet note and the blue Save adjustments button — no Risk field in this crop, and the shared alt correctly omits "risk" (test asserts `alt[0]` contains "profit and discount" and not `/risk/i`).
  - 2D programme crops show optional stages starting "Strip out" and "First fix and boarding", per-stage lengths and reorder/remove controls. The shared alt says "starting with" and omits "four"/Tiling/Second fix/Add a stage, which is exactly right for the shorter phone crop; test asserts both directions.
- Alt text is accurate for both crops of each figure. Dates correct: figure captions carry `<time datetime="2026-10-03">3 October 2026</time>` and `2026-10-04` / `4 October 2026`, matching `docs/evidence/stage2-tranche-2c/README.md` (captured 3 October 2026) and `2d/README.md` (captured 4 October 2026). Both READMEs state synthetic data only, real components mounted via a temporary harness, mocked persistence stand-ins, nothing written to any database, no email sent, no AI model called, emulated viewports — and the visible page copy states synthetic captures, earlier interface, mocked persistence, not the current hosted interface, not proof of saving/AI/email/customer availability, and that the blue controls are the earlier look. Every qualification the brief demanded is present in visible text, not just metadata.
- No private customer data in any of the four images: only the synthetic "14 Example Road bathroom refit" project and `contractor@example.test` identity documented in the READMEs.
- No fake prices or durations: section/figure text contains no £ figures or %/day/week claims (test enforces `/£|\b\d+\s*(%|working days?|weeks?)\b/i` absent); the £14,395.70 in the capture is visible only inside the screenshot, and the caption states the figures are synthetic and "not prices, typical margins or a quote".
- No new controls, forms, links, carousels, modals, scripts, providers, gates or client state: server component (no `'use client'`, no hooks, no `fetch`, no `process.env`, no launch-profile check), and the test asserts no `<a>/<button>/<form>/<input>/<select>/<textarea>/<dialog>/<script>/<iframe>` in the rendered section.

**Tests**
- The test file is new; the net diff modifies no existing test file — nothing deleted, skipped or weakened.
- Tests derive from actual rendered markup (`renderToStaticMarkup`) and actual bytes (sha1 of the git blob format) rather than re-asserting constants: placement/order/uniqueness on the features route, absence from home/pricing/full-profile and cohort gating via `NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE`, picture/source/srcset pairing per figure, alt fidelity to both crops, visible qualification strings, per-caption dates/labels, no price/duration/availability claims, no added controls, heading order (h2 → h3, h3), asset blob identity, and no data transmission/remote CSS.
- Checked by inspection (not executed — see limits): regexes and string assertions match the actual component copy in the target blobs; heading levels in the component are h2 (section title) then h3 per figure; `key={capture.capturedOn}` is unique across the two captures.

**Companion job (context, not re-reviewed)**
- Companion `42de411405abcee80b1bd3f5af47e1b7d583aa7c` (`09aeb50..42de411`) touches `phase-one.tsx` only at `MarketingFooter` (mailto `Get in touch` → existing `/contact` Link) plus `marketing-footer-contact-nav.test.tsx` and docs. Its hunk (line ~39) is disjoint from the imagery hunks (import line ~5, `PhaseOneFeatures` line ~139); `42de411` adds no import, so the two deltas merge without overlap. Parent must merge the exact deltas, not whole files — they are textually independent. Cohort contact stays mailto-only on `/contact` with the full legacy form retained; Claude's independent PASS on those 40 tests was already returned and I did not rerun them.

## Required findings

None.

## Nonblocking limits

- **No reviewer runtime**: per the task, Node commands were approval-blocked for the author, so there is no author Vitest/tsc/lint/build receipt, and I performed a source/static review only — I did not run tests, typecheck, lint, build, browser or capture. The test file reads correct-by-inspection against the target blobs; the parent's material checks own execution evidence.
- **601–800px band** renders the 1280×800 desktop capture at near-full viewport width (the phone source stops at 600px), so screenshot text is small in that band. This is the disclosed tradeoff of choosing the existing phone captures over shrinking the desktop figures; I did not treat it as a defect and invented no same-pixel or current-hosted acceptance gate.
- Shared alt across crops deliberately describes the union that is true of both; the desktop estimate crop additionally shows a Risk (%) field the alt omits — an accurate omission (the alt is true of both crops), not a false statement.
- Images are the committed 3/4 Oct 2026 evidence captures; they show an earlier interface and are explicitly labelled as such on the page. This is qualified, not hidden, and no current-hosted-UI claim is made anywhere in the new source.
- Evidence is synthetic-component capture evidence with mocked persistence; it is not proof of hosted behaviour, real persistence, AI, email or customer use — and the page says so in visible text.

## Evidence limits of this review

Reviewed exact `git show` blobs at `1250d1b`, the committed asset bytes, the two evidence READMEs, and all four screenshots rendered from those bytes. I did not execute the suite, open the app, or re-run the author's checks; this document is a review artifact only, not accepted ROOT source or completion proof, and it implies no dispatch, model-usage or runtime claim.
