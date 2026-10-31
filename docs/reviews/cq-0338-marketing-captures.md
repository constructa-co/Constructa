# cq-0338 marketing captures (A110/A084)

Status: **source-ready, NOT verified.** No test, lint or type check ran in this job. See "Commands".

- Base: `09aeb5067c5b9943ec54d6644c6ac3323f8f05c4`
- Branch: `cq/cq-0338-marketing-captures`
- Worktree: `.cq-wt/cq-0431-a038-upload-outcomes`

## Changes

| File | Change |
| --- | --- |
| `src/components/marketing/product-screenshots.tsx` | New. Section with two figures, using Next Image and static imports |
| `src/components/marketing/product-screenshots.module.css` | New. Stacked full-width figures and the qualification panel |
| `src/components/marketing/product-screenshots.test.tsx` | New. The one focused test |
| `src/components/marketing/phase-one.tsx` | One import, and `<ProductScreenshots />` in `PhaseOneFeatures` between `ProductReviewGuide` and `Scope` |
| `docs/reviews/cq-0338-marketing-captures.md` | This record |

Not touched: `phase-one.module.css`, `MarketingFooter`, the contact route, Home, Pricing, full variants, flags, application code, evidence images and READMEs. No image was recaptured, copied or moved.

## Source assets

SHA-256 is not recorded because `shasum` was blocked (see "Commands"). The identifiers below are git blob ids (SHA-1) from `git ls-files -s`. The new test recomputes them from the file bytes.

| Asset | Git blob | Captured |
| --- | --- | --- |
| `docs/evidence/stage2-tranche-2c/18b-estimate-price-adjustments-preview-1280x800.jpg` | `2c3e96d85808740883ce037d7f643b6fedd1edf0` | 3 October 2026 |
| `docs/evidence/stage2-tranche-2d/04-programme-four-stages-editor-1280x800.jpg` | `bf1fdf6646344a6aaf50806bc851439e13c462c9` | 4 October 2026 |

Pixel size was not read with a tool because `sips` was blocked. 1280×800 comes from the filenames, the README viewport statements and `viewportWidth: 1280` in the metrics. Both images displayed at that size when read.

## Qualifications read from the evidence

Both READMEs (Tranche 2C and 2D):

- Synthetic data only. No real customer data, credentials or secrets. Contractor `contractor@example.test`, project "14 Example Road bathroom refit".
- Captured from a temporary local harness that mounted the real components with synthetic props. Server calls were replaced by stand-ins. The harness was deleted before commit.
- Nothing was written to any database and no AI model was called. Tranche 2D also states that no email was sent.
- Real routes and server-rendered pages were not exercised in a browser.
- Built from production `next build` + `next start` on localhost, in headless Chrome.

`capture-metrics.json`:

- `18b…1280x800`: `horizontalOverflow: false`, `tapTargetsUnder44: []`, preview text "Not saved yet. With these adjustments the total before VAT would be £14,395.70." while `totalStillSaved` is £11,380.00.
- `04…1280x800`: `horizontalOverflow: false`, `tapTargetsUnder44: []`, `stageCount: 4`, `total: "3 weeks, from your stages"`.

These are 1280 px capture metrics for the earlier screens. They say nothing about the new marketing section.

Both images were opened in this job. Visible identity data is `contractor@example.test` and "14 Example Road". Sample amounts and durations in the images are not repeated in captions or alt text.

## Commands

Each was attempted once. No launcher variation, permission bypass or weakened check followed.

| Argv | Result |
| --- | --- |
| `/usr/local/bin/node -v` | Not run. `This command requires approval`. No exit code. Node version unconfirmed |
| `/usr/local/bin/node node_modules/vitest/vitest.mjs run src/components/marketing/product-screenshots.test.tsx src/components/marketing/phase-one.test.tsx src/components/marketing/product-review-guide.test.tsx src/components/marketing/phase-one-responsive.test.ts src/components/marketing/readability.test.ts` | Not run. `This command requires approval`. No exit code |
| `/usr/local/bin/node node_modules/.bin/eslint src/components/marketing/product-screenshots.tsx src/components/marketing/product-screenshots.test.tsx src/components/marketing/phase-one.tsx` | Not run. `This command requires approval`. No exit code. Note `node_modules/.bin` was not seen in the `ls -la node_modules/` listing, so the parent may need the root checkout's eslint path |
| `shasum -a 256 <both images>` | Not run. `This command requires approval`. No exit code |
| `sips -g pixelWidth -g pixelHeight <both images>` | Not run. `This command requires approval`. No exit code |
| `git check-ignore -v <estimate image>` | Not run. `This command requires approval`. `.gitignore` and `.vercelignore` were searched instead: no entry excludes `docs/evidence` |
| `git ls-files -s <both images>` | Exit 0. Blobs above |
| `git rev-parse HEAD` | Exit 0. Base above |

No type check was attempted, because it uses the same blocked Node launcher.

Parent to run: the vitest argv above once, eslint on the three files, and `npx tsc --noEmit`.

## Unverified points for the parent and Kimi

1. **Test adaptations.** None have been needed yet, because nothing ran. The test has not been seen passing. Under Vite a `.jpg` import is a string path rather than `StaticImageData`, so the component passes explicit `width` and `height`. Both Next and Vite should accept that, but this is unproven here.
2. **Rendered page.** No browser or build was used. Layout, CSS module output and the Next image response are unobserved.
3. **`/// <reference types="next/image-types/global" />`.** `next-env.d.ts` is git-ignored and `.github/workflows/ci.yml` has a `typecheck` step. Without the reference, the `.jpg` imports could fail that check on a clean checkout. It is a type-only line.
4. **Build-time import from `docs/`.** `.vercelignore` does not exclude `docs/evidence`, so the files should be in the deployment upload. A real `next build` has not confirmed this, and builds were out of scope.

## Known limit

Figures stack at full width because a two-column layout would shrink the 1280 px captures to about 60%. At desktop widths the screen text should stay legible. At 390 px the same image scales to about 27%, so its small text is not readable without pinch zoom. The caption and alt text carry the meaning there. The committed `-390x844` captures would suit phones but were outside the two exact assets named, and a sideways scroller would add a focusable control.

The Next image optimiser may re-encode served variants at request time. The committed source files stay unchanged.

## Raw failures

Only the approval refusals in "Commands". No test failure occurred, because no test ran.

## Not done

No commit, push, PR, deploy, SQL, settings, key or `.env` access. No Kimi or Cursor verdict is claimed. Those checks are arranged by the parent.
