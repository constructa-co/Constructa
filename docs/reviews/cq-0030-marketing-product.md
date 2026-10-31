FAIL: source is written, but no test, lint or typecheck has run and the Cursor check has not happened.

# CQ-0030 marketing product: /features review guide (A001 coverage)

Date: 2026-11-01
Branch: `cq/cq-0030-marketing-product`
Parent commit: `671ff23de34084cc3f3dc346fd67a72ef8a24e21`
Worktree: `.cq-wt/cq-0431-a038-upload-outcomes`
State: uncommitted, for the runner to commit.

## Files

| Path | Change |
| --- | --- |
| `src/components/marketing/product-review-guide.tsx` | New `ProductReviewGuide` section |
| `src/components/marketing/product-review-guide.module.css` | New styles, using the theme variables inherited from `.theme` |
| `src/components/marketing/product-review-guide.test.tsx` | New focused test, 9 cases |
| `src/components/marketing/phase-one.tsx` | One import, and `<ProductReviewGuide />` after `<Journey />` in `PhaseOneFeatures` |
| `docs/reviews/cq-0030-marketing-product.md` | This note |

`phase-one.module.css` and the contact route were not edited. The guide imports
`phase-one.module.css` read-only to reuse `.section`, `.sectionIntro`, `.eyebrow`
and `.textLink`.

## What the visitor gets

- Four steps (Company, Brief and price, Programme, Proposal), each showing
  You add, You get and Check before sharing.
- "What you can review" beside "Held back from this preview". Held items are
  live AI, new sign-up, real-customer release, checkout and payment, complete
  photo/consent/recovery journeys, and security certification (none claimed).
- Next steps link only to the existing `/login` and `/pricing`.

Wording was taken from current source: `profile-form.tsx`, `brief-client.tsx`,
`simple-programme-client.tsx`, `review-send-client.tsx` and `proposal-response.ts`.

## Commands and exits

| Command | Exit | Note |
| --- | --- | --- |
| `node -v` | 0 | v26.12.1 from `/opt/homebrew/bin/node`; not the pinned Node version |
| `which -a node` | 0 | `/opt/homebrew/bin/node`, `/usr/local/bin/node` |
| `/usr/local/bin/node -v` | not run | Approval required, blocked |
| `/opt/homebrew/opt/node@24/bin/node -v` | not run | Approval required, blocked |
| `/Users/robertsmith/.nvm/versions/node/v24.19.0/bin/node -v` | not run | Approval required, blocked |
| `cursor-agent --help` | not run | Approval required, blocked |
| `printenv TMPDIR` | not run | Approval required, blocked; no temp files were created |

The three Node probes were looking for the pinned binary and were stopped once
all three were blocked. Vitest was not started on Node 26, because the task
allows Node 24 only.

Not run: focused test, `phase-one.test.tsx`, direct ESLint, typecheck. Nothing
has proven the new test passes. No version pin is recorded because no pinned
Node ran. No build, install, env read, browser, provider, DB or network call
was made.

## Remaining scope

1. On Node 24, using root deps and the existing symlinks, run from this worktree:
   - `vitest run src/components/marketing/product-review-guide.test.tsx src/components/marketing/phase-one.test.tsx`
   - `eslint src/components/marketing/phase-one.tsx src/components/marketing/product-review-guide.tsx src/components/marketing/product-review-guide.test.tsx`
   - `tsc --noEmit`, if material
2. Run the independent Cursor Composer 2.5 check with fast mode off.
3. Check the layout visually at desktop, 1100px, 800px and phone widths. None of
   this has been viewed in a browser.

## Open point

`/product` also renders `PhaseOneFeatures`, so it shows the guide too. The brief
says features only, but changing that means editing `src/app/product/page.tsx`
or adding a prop, both outside this scope. The test asserts the guide is on
`/features` and `/product` and absent from Home, Pricing and the full profile.
