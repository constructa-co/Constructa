# cq-0338-marketing-contact-nav — Composer delivery receipt

**Branch:** `cq/cq-0338-marketing-contact-nav`  
**Base:** `09aeb5067c5b9943ec54d6644c6ac3323f8f05c4` (HEAD at job start matched base)  
**Scope:** MarketingFooter “Get in touch” → internal `/contact`; one rendered-source navigation test; no contact page / full-profile footer / PhaseOneFeatures edits.

## Source delta (owned)

| File | Intent |
|------|--------|
| `src/components/marketing/phase-one.tsx` (~L39) | Replace footer `<a href="mailto:hello@constructa.co">Get in touch</a>` with `<Link href="/contact">Get in touch</Link>`. Label and surrounding footer markup unchanged. |
| `src/components/marketing/marketing-footer-contact-nav.test.tsx` (new) | Single integration test: `MarketingFooter` static markup → `/contact`; cohort `ContactPage()` → mailto-only, no form; full profile → legacy Formspree form, field names, submit label, h1 copy, secondary mailto retained. |

**SHA-256 (working tree at check time):**

- `phase-one.tsx`: `8f232aff2e5129bbf53a43974b86471d8b38c6c8609da659af87561d9572d96b`
- `marketing-footer-contact-nav.test.tsx`: `0f0cafe8bbc8074ac1fc0a87919bfb0c1730c8300ce450716967dffc105ec58d`

## Checks run (once each)

### Vitest — materially affected tests

**Argv:**

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
TMPDIR=/tmp VITE_TEMP_DIR=/tmp/vitest-cq-0338 /opt/homebrew/bin/node node_modules/vitest/vitest.mjs run \
  src/components/marketing/marketing-footer-contact-nav.test.tsx \
  src/components/marketing/phase-one.test.tsx \
  src/app/contact/contact-launch-profile.test.tsx \
  src/app/contact/contact-labels.test.tsx
```

**Node:** `v24.19.0` (`/opt/homebrew/bin/node`)  
**Exit:** `0`  
**Result:** 4 files, **40 tests passed** (1 new + 39 existing contact/phase-one).  
**Duration:** ~472ms  
**Limits:** No `next build`, no full suite, no install, no dependency changes.

**Prior runtime failure (same argv without `TMPDIR=/tmp`):** exit `1`, Vitest worker `EPERM: operation not permitted, mkdir '/Users/robertsmith/constructa-queue/tmp/cq-0338-marketing-contact-nav/.../ssr'`. Resolved by forcing `TMPDIR=/tmp` (and `VITE_TEMP_DIR` under `/tmp`) per job TMPDIR rule — not a product/test failure.

### ESLint — owned paths only

**Argv:**

```bash
npx eslint src/components/marketing/phase-one.tsx src/components/marketing/marketing-footer-contact-nav.test.tsx
```

**Exit:** `0` (no errors on owned files)

## Expectation adaptation for independent Claude check

**None required.** Existing `phase-one.test.tsx` and `contact-*.test.tsx` assertions unchanged; no skips/weakening. Full-profile legacy form assertions mirror `contact-launch-profile.test.tsx` (“retains the legacy form…”) inside the new footer navigation test only.

## Out of scope (unchanged)

- Cohort contact component mailto CTAs (`cohort-contact.tsx`)
- Full-profile `Footer.tsx` / Formspree contact form (`src/app/contact/page.tsx` full branch)
- `PhaseOneFeatures` screenshot import (concurrent Claude worktree)
- Commit, push, deploy, SQL, settings/keys, build copies

**Status:** Source + focused tests green under Node 24 with `/tmp` isolation. Runner owns commit/push and independent Claude check.
