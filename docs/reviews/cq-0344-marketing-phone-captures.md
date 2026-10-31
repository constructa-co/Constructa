# cq-0344 marketing phone captures (repair to cq-0338)

Status: **source-ready, NOT runtime verified.** No test, lint, type check, build or browser ran in this job. See "Commands". This record does not mark the work Complete.

- Base: `4adfad9d37641e9a4e81e7e9cc234576cd8d9d53`
- Branch: `cq/cq-0338-marketing-captures`
- Worktree: `.cq-wt/cq-0431-a038-upload-outcomes`
- Known finding repaired: the "Known limit" in `docs/reviews/cq-0338-marketing-captures.md`. At 390 px the 1280 px captures scale to about 27%, so their text is unreadable. That record is unchanged.

## Changes

| File | Change |
| --- | --- |
| `src/components/marketing/product-screenshots.tsx` | Imports the two phone captures. `next/image` `getImageProps` feeds a new `CapturePicture` that renders `<picture>`. Both alt texts rewritten |
| `src/components/marketing/product-screenshots.module.css` | One rule: `.figure picture { display: block; }` |
| `src/components/marketing/product-screenshots.test.tsx` | Phone assets added to the blob check. Two new tests. Helpers `pictures` and `srcset` |
| `docs/reviews/cq-0344-marketing-phone-captures.md` | This record |

`phase-one.tsx` and all other source are not edited in this repair. `git status --short` showed only the three source files above before this record was written. No image was copied, edited, cropped, recaptured or moved.

## Responsive behaviour

- Each figure is `<picture>` with one `<source media="(max-width: 600px)" width="780" height="1688" sizes="88vw">`, then the desktop `<img>` as the default. No JS, carousel, modal, zoom control or new dependency.
- `getImageProps` is the supported Next route to art direction. Both srcsets come from the existing image optimiser. The `<img>` keeps `loading="lazy"` from it, and keeps its 1280×800 attributes and original `sizes`.
- 780×1688 are the actual pixels of a `390×844` viewport at device scale 2, not a new capture. The Tranche 2C and 2D READMEs state that scale. The pixels were read from the images as displayed in this job, because `sips` was refused.
- Natural aspect ratio: the existing `height: auto` applies and nothing crops, so each full image displays. The phone image is tall: about 740 px high at a 390 px viewport (88vw × 1688/780), by arithmetic only.
- `sizes="88vw"` follows `.section` padding of 6% each side at 800 px and below.
- 600 px is a new breakpoint, chosen rather than the existing 800 px because the phone capture would reach about 1,520 px high at 800 px. Between 601 and 800 px the desktop capture still shows, at about 41–55% scale, so its text stays small there.

## Alt text

One alt serves both crops, so it names only what both show. Both images were opened in this job.

- Estimate: the phone view clips the Risk label to a fragment, so "risk" is removed. Profit, Discount, the reason field, the Not saved yet note and Save adjustments show in both.
- Programme: the phone view stops at stage 3, so "four", Second fix and finish, and Add a stage are removed. Tiling is left out too, because its controls are clipped on the phone. The alt names only the first two stages. Lengths and reorder/remove controls show in both.

Unchanged: the captions, the `<time>` dates (3 and 4 October 2026), the section heading, and the qualification (earlier interface, made-up data, mocked persistence, not the current hosted interface, not proof that saving, AI, email or customer use is available, blue controls belong to the earlier interface).

The estimate caption still says "risk, profit and discount percentages". That caption describes the step, not the crop, and it is correct for the desktop view.

## Tests

Added:

- `swaps each figure to its own phone capture through a declarative narrow source`: two pictures, one source before the img, media, sizes and 780×1688, each figure's correct phone and desktop pair with no cross-over, and lazy loading.
- `keeps alt text true of both the desktop and the shorter phone view`: required phrases are present and clipped labels are absent.

Adapted: `assets` now lists four files, so the existing blob check also covers the phone captures. No assertion was removed or loosened. The existing date, qualifier, intrinsic-size and `Save adjustments` / `Strip out` alt assertions stand as written.

Neither new test has been seen passing. They assume `srcset` is emitted lowercase or matched case-insensitively (the helper uses `/i`) and that the file name survives in the decoded srcset under Vite's string `.jpg` import.

## Assets

Git blob ids (SHA-1) from `git ls-files -s`. The test recomputes them from the file bytes.

| Asset | Git blob | Captured |
| --- | --- | --- |
| `docs/evidence/stage2-tranche-2c/18b-estimate-price-adjustments-preview-1280x800.jpg` | `2c3e96d85808740883ce037d7f643b6fedd1edf0` | 3 October 2026 |
| `docs/evidence/stage2-tranche-2c/18b-estimate-price-adjustments-preview-390x844.jpg` | `9cba27990d62f67bc5dc713f35e4f419f27be981` | 3 October 2026 |
| `docs/evidence/stage2-tranche-2d/04-programme-four-stages-editor-1280x800.jpg` | `bf1fdf6646344a6aaf50806bc851439e13c462c9` | 4 October 2026 |
| `docs/evidence/stage2-tranche-2d/04-programme-four-stages-editor-390x844.jpg` | `be2f5de8c244c25268e67cfb2ce8f9ee638ff273` | 4 October 2026 |

Phone capture dates are taken from the parent's statement that these are the same approved captures. This job did not read them from `capture-metrics.json`.

Source blobs at base, from `git ls-files -s`. Repaired-file blobs are not recorded because `git hash-object` and `shasum` were refused. The runner's commit will fix them.

| File | Blob at base |
| --- | --- |
| `src/components/marketing/product-screenshots.tsx` | `f6cf75ed0a40c1b978ed6dc579cb49a5fa391a5a` |
| `src/components/marketing/product-screenshots.module.css` | `1d9f8525df4ee1c084a52eac6d2b9a145b5b75ea` |
| `src/components/marketing/product-screenshots.test.tsx` | `17eee5f2d986fc46e8720ee1c91e4240c61702d8` |
| `src/components/marketing/phase-one.tsx` (untouched) | `fd9c370b4261b39bac602317944fa9476900a9d3` |

## Commands

Each refused command was attempted once. No launcher variation, permission bypass or other runtime followed.

| Argv | Result |
| --- | --- |
| `/usr/local/bin/node -v` | Not run. `This command requires approval`. No exit code. Node version unconfirmed. `.nvmrc` pins 24.19.0 |
| `sips -g pixelWidth -g pixelHeight <both phone images>` | Not run. `This command requires approval`. No exit code |
| `shasum -a 256 <three source files>` | Not run. `This command requires approval`. No exit code |
| `git hash-object <three source files>` | Not run. `This command requires approval`. No exit code |
| `git ls-files -s <four images>` | Exit 0. Blobs above |
| `git ls-files -s <four source files>` | Exit 0. Blobs above |
| `git status --short` | Exit 0. Three source files modified |

Vitest, eslint and tsc were not attempted, because they use the same refused Node launcher. The worktree's `node_modules` holds only vite and vitest links, so `next` could not be inspected here either. `getImageProps` being exported by the installed Next 16 is expected from `package.json` `^16.3.7`, but was not confirmed: a grep of the root `node_modules` was blocked as outside the working directory.

Parent to run: the focused `src/components/marketing/product-screenshots.test.tsx` check from the root, eslint on the three files, and `npx tsc --noEmit`.

## Unverified points

1. The new and existing tests have not run on this source.
2. No browser has shown the source swap at any width, the rendered height, or the optimiser's phone output.
3. `<img>` lint: `@next/next/no-img-element` should exempt an `<img>` directly inside `<picture>`, and `alt` is passed explicitly for `jsx-a11y/alt-text`. Eslint did not run, so neither is confirmed.
4. Items 3 and 4 of "Unverified points" in the cq-0338 record (`next/image-types` reference, build-time import from `docs/`) still apply, now to four files.

## Not done

No commit, push, PR, deploy, SQL, settings, key or `.env` access. No Cursor or Kimi verdict is claimed.
