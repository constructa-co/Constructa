# D51 — Proposal snags 027 / 038 / 039 / 059 — evidence — 16 November 2026

Branch `claude/d51-proposal-evidence`, base `1b1c5cc`. The source patch is the
uncommitted working tree of this worktree. Nothing was committed, pushed,
deployed, installed, deleted or applied to a database. No settings, secrets,
SQL, signup or publication were touched.

## Evidence limits — read first

- **No check was run.** This session had file read/write tools only and no
  shell. `npx tsc --noEmit`, Vitest, the Node 24 `next build`, the Supabase
  target guards and the secret scan are all **NOT RUN**. The tests below were
  written and desk-checked against the source; none has been executed.
- **The snag register was not readable.** The D51 register and the Constructa
  inbox sit outside this worktree and read access was refused. The mapping of
  IDs to snags is taken from the order of the task wording: 027 site photos,
  038 director's message, 039 programme labels, 059 terms. Confirm it.
- No browser, PDF viewer or hosted evidence. Behaviour is evidenced by source
  and by unit tests that still need running.

Run before grading (from this worktree, Node 24):

```bash
npx tsc --noEmit
npx vitest run src/lib/proposal-site-photos.test.ts src/lib/proposal-document.test.ts \
  src/lib/proposal-publication.test.ts src/lib/proposal-review.test.ts \
  src/lib/pdf src/lib/proposal-terms-lineage.test.tsx src/lib/company-closing.test.ts \
  src/app/dashboard/projects/proposal
```

## 027 — Unrelated site photos

Found in source: the proposal screen uploads to the `proposal-photos` bucket
under `<user id>/proposal/<project id>/`, but the draft save accepted any safe
https link as a site photo, and the snapshot published whatever was saved. A
link to another job's photo, a branding image or a case-study image in the
same bucket could be saved and sent under "Site photographs".

Now:

| Where | Behaviour |
| --- | --- |
| `sitePhotoOrigin` (`src/lib/proposal-site-photos.ts`) | Reads the link only. `this-job`, `elsewhere` (another project, another contractor's folder, `branding`, `case-study`) or `unknown` (does not follow the upload layout) |
| `saveProposalDraftAction` | Refuses an `elsewhere` photo before any write: "One of the photos was not uploaded for this job, so it can't be used here. Remove it and add the photo again." |
| `buildProposalPublicationSnapshot` | Preview and send both leave `elsewhere` photos out of `photos` and out of the site cover image. Same function for both, so the reviewed-content fingerprint still matches |
| Review screen | A saved photo that is being left out says so beside the photo, with the remove button under it |

Tests (not run): `proposal-site-photos.test.ts` (origin rules; snapshot,
document and preview; issued snapshot untouched), `actions.test.ts` "D51 …"
(four refusals without a write; accepted save; publish omits the other job's
photo and still matches the preview).

Not changed: `sanitisePhotos`, the document renderer and the public page. An
issued snapshot is drawn with the photographs it was issued with.

## 038 — Duplicate director's message

Found in source: "Use saved company message" copies `profiles.md_message` into
the closing wording, and `aboutSection` also prints the same message as a
quote under About. The helper text said so: "It can also appear under About
your business."

Now, on snapshots at presentation 4: when the closing wording contains the
director's message (compared with spacing collapsed), the About quote is left
out and the message is read once, as the closing. A closing that says
something else, or no closing, leaves the About quote as before. Helper text
now reads: "Used here, it is shown once, as your closing message, and is left
out of About your business."

Tests (not run): `proposal-document.test.ts` "D51 director's message is shown
once" — one occurrence on the page and in the PDF; same after edits around
it; unchanged when the closing differs; presentations 2 and 3 and absent still
show both.

## 039 — Clipped programme labels

Found in source: `proposal-brochure.ts` drew a stage name with
`wrap(stage.name, …).slice(0, 1)`, so a name wider than its 92 mm column lost
everything after the first line. Stage names can be 200 characters. The web
page already wraps the name in full.

Now, on snapshots at presentation 4: every wrapped line of the name is drawn
and the row, its bar and its start tick move down by the extra lines. A
one-line name is drawn exactly where it was (same 13 mm row).

Tests (not run): `proposal-document.test.ts` "D51 programme stage names in the
PDF" — full name in the PDF text, taller row for that stage only, rows within
the page; presentations 2 and 3 keep the first line only and 13 mm rows. The existing
`proposal-programme-bars.test.ts` geometry assertions should hold unchanged
for one-line names.

## 059 — Terms gap

Documented in `d51-terms-gap.md` from source, quoting existing clauses only.
No term, notice or default was changed.

## Issued proposals

- New snapshots are written with `document_presentation_version: 4`
  (`CURRENT_DOCUMENT_PRESENTATION_VERSION`). The value is outside both the
  snapshot hash and the reviewed-content hash, as it was at 2.
- The message de-duplication and the full stage names apply only at 4 or
  above. A snapshot at 1, 2 or 3, or with no version, is built and drawn as
  before. (Presentation 3 is #186's label suppression, which still applies
  from 3 upward.)
- The photo rule acts when a draft is saved and when a snapshot is built. It
  never filters a stored snapshot.
- No stored row is rewritten by any of this.

## Owner decisions (Rob)

1. **Photos that do not follow the upload layout.** Older uploads and images
   hosted elsewhere say nothing about which job they are from, so they are
   still accepted. Tightening to "this job's folder only" would leave any such
   photo out of new proposals. Which is wanted?
2. **Drafts that already hold another job's photo.** They cannot be saved
   again until that photo is removed (the file itself is not deleted). Is that
   acceptable for existing cohort data, or should it warn without blocking?
3. **Which copy of the director's message is kept.** The closing is kept and
   the About quote dropped, because the closing is the contractor's explicit
   choice for this proposal. Confirm, or reverse.
4. **Issued PDFs.** A PDF downloaded again from a proposal issued before this
   change keeps a clipped stage name and both copies of the message, to stay
   as issued. Say if issued PDFs should instead print the stage name in full.
5. **Terms.** The five questions in `d51-terms-gap.md`.
6. **Snag mapping.** Confirm 027/038/039/059 match the four snags above.
