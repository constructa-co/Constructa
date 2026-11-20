# D63 CON-061 — Case-study photo behaviour

**Branch:** `codex/d63-case-photo-behaviour`  
**Base:** `25b83a1` (verified main, source-only lane)  
**Register:** A038 partial seam (photos); CTO 20 Nov 15:30 UAE scope for CON-061.

## Scope delivered

| Rule | Implementation |
| --- | --- |
| First upload is main unless the contractor chooses another | `primaryPhotoIndex` on legacy past-work rows; first successful upload sets it when unset; **Use as main** on each active slot |
| Exact duplicate files (SHA-256) not added twice | `caseStudyPhotoContentHash` before upload; refusal toast `CASE_STUDY_DUPLICATE_PHOTO_MESSAGE` |
| Legacy pictures preserved and shown after the three active slots | `splitLegacyProfilePhotoUrls` / `mergeLegacyProfilePhotoUrls`; `data-legacy-photos` strip; saves allow three active + safe https tail |
| Proposals use main-first ordering, tail excluded | `legacyProfileCaseStudyPhotos` in `selectCaseStudies`; `libraryCaseStudyProposalPhotos` in library resolve |

## Files touched

| File | Intent |
| --- | --- |
| `src/lib/case-library/case-study-photo-behaviour.ts` | Pure rules: hash, split/merge, primary order |
| `src/lib/case-library/case-study-photo-behaviour.test.ts` | Focused regressions |
| `src/lib/case-library/legacy-photos.ts` | Save validation for active + legacy tail |
| `src/lib/proposal-publication.ts` | Primary-ordered legacy photos on proposals |
| `src/lib/case-library/resolve.ts` | Library publication photo order |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | Legacy editor UX |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | Library upload duplicate + primary |
| `src/app/dashboard/settings/case-studies/library/case-study-photo-slots.tsx` | Main badge / control |
| Tests under `case-studies/` and `legacy-photos.test.ts` | Behaviour contracts |

## Limits (this session)

- **Checks not run** here (no local test/build per lane rules). Root owns Vitest/tsc and draft PR.
- **No** schema migration, storage provider changes, or `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` flip.
- Library **primary** is session-local until a future wire field; legacy `profiles.case_studies` persists `primaryPhotoIndex`.
- Content-hash dedupe applies to **new file picks** in the session, not to unrelated duplicate URLs already stored.

## Snag mapping

Original register **A038** asked to retain up to three photos in the improved journey; **CON-061** (CTO D63) adds ordering, dedupe, and legacy tail display without dropping stored urls beyond the proposal cap of three active pictures.
Codex integration before packaging: browser Web Crypto only (no Node crypto in client graph); pending hash reservation blocks parallel duplicate picks; strict legacy string validation retained. Library primary choice reorders existing slots and is offered only while existing photo wire allows persistence; no new schema or wire flag.
