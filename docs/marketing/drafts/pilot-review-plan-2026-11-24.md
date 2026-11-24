# Pilot review plan — D105 marketing drafts (DRAFT — UNPUBLISHED)

All assets in `docs/marketing/drafts/` are **unpublished repository drafts for Rob review**. No new public routes, social dispatch, or measurement activation in this pass.

Aligns with `docs/marketing/contractor-guide-pilot.md` and `docs/marketing/private-editorial-workflow.md`.

## URL policy (D89)

| Use for review | Do not assert without evidence |
| --- | --- |
| `https://constructa-nu.vercel.app/guides/{slug}` — verified hosted guides (including `how-saved-job-data-connects`) | `https://www.constructa.co/guides/...` as live/canonical — intended future canonical, **unverified** pending domain handoff |

## Assets in this folder

| File | Channel | Guide slugs cited |
| --- | --- | --- |
| `linkedin-saved-job-data-2026-11-24.md` | LinkedIn | `how-saved-job-data-connects`, `review-brief-and-price`, `programme-and-proposal-before-sharing` |
| `facebook-programme-check-2026-11-24.md` | Facebook | `programme-and-proposal-before-sharing`, `how-saved-job-data-connects` |
| `medium-brief-to-proposal-2026-11-24.md` | Medium | same three |

## Review steps (bounded)

1. **Editorial** — Read each draft against approved source copy in `src/lib/marketing-guides.ts` and, where needed, the matching page on `constructa-nu.vercel.app/guides/...`. No product writes required for draft review. Flag claims not supported by approved guide copy (e.g. auto-BoQ, send-on-download, legal acceptance).
2. **URL check** — Confirm cited `constructa-nu.vercel.app` guide URLs load before any external post. Do not treat www as verified.
3. **Publication gate** — Owner (Rob) approval only. Holds on signup/forms/publication remain as per delivery inbox; do not infer analytics or Plausible configuration from those holds alone.

## Measurement (honest)

Search, traffic, and conversion results for these **unpublished** drafts are **not available** — nothing has been posted. Do not cite fabricated metrics. After owner approval to publish, optional review may use **existing authorised** analytics access only, if the owner chooses; this plan does **not** enable settings, goals, or measurement activation.

## Out of scope for D105

- New public routes or guide slugs
- Resend / social APIs
- Paid promotion or UTM campaigns
- Requiring a reviewer to run a full hosted product journey as a draft acceptance gate