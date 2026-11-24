# Pilot review plan — D105 marketing drafts (DRAFT)

Aligns with `docs/marketing/contractor-guide-pilot.md` and `docs/marketing/private-editorial-workflow.md`. No publication, forms, or measurement hooks in this pass.

## Assets in this folder

| File | Channel | Cited guide slug(s) |
| --- | --- | --- |
| `linkedin-saved-job-data-2026-11-24.md` | LinkedIn | `how-saved-job-data-connects`, `review-brief-and-price`, `programme-and-proposal-before-sharing` |
| `facebook-programme-check-2026-11-24.md` | Facebook | `programme-and-proposal-before-sharing`, `how-saved-job-data-connects` |
| `medium-brief-to-proposal-2026-11-24.md` | Medium | same three public guide URLs |

## Review steps

1. **Editorial** — Compare each draft sentence to the live guide copy in `src/lib/marketing-guides.ts` and rendered `/guides/[slug]` pages on `www.constructa.co`. Flag any claim not supported by product behaviour today (especially auto-BoQ, send-on-download, acceptance).
2. **Contractor read** — One reviewer runs a real job through brief → estimate → programme → proposal and notes one check they would add to the draft.
3. **URL verification** — Confirm all `constructa.co/guides/...` links return 200 before any external post.
4. **Publication gate** — Owner approval only; cohort signup and Plausible goals remain OFF per delivery holds (#228).

## Out of scope for D105

- New public routes or guide slugs
- Resend / social APIs
- Paid promotion or UTM campaigns