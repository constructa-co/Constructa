# Stage 2G.4 (G4A2): case-study library client candidate — builder report

One candidate holding both halves: the library screens and actions, and their use on Review and Send. Everything new sits behind one server-side switch that is off by default. Fixture and unit evidence only: no hosted project was contacted, no migration applied anywhere, no provider called, no secret read, no dependency added. Not pushed, merged or deployed. This is a hand-off for independent review, not an approval, and not a claim of launch readiness.

Written 8 October 2026 by the primary builder (Claude). The reconciled design this was built to is `STAGE2G4A2-CLAUDE-CLIENT-DESIGN-RECONCILED.md`, outside this repository.

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-client` |
| Branch | `claude/stage2g4-client` (local only) |
| Base | `63ca10f25070a4ed0d45ae011f98a769bfa2bfda` (accepted foundation, unchanged in its own worktree) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-client.patch` |

## 2. What was built

### The switch (F1)

`CONSTRUCTA_CASE_LIBRARY=1`, read in one file (`src/lib/case-library/gate.ts`), on the server only, default off.

- **New pages** (`settings/case-studies/library/new`, `library/[id]`): signed in first, then the switch, then reads. Off redirects to the Case Studies page.
- **New actions** (`settings/case-studies/library-actions.ts`, eight of them): sign-in, then the switch, then the service, which validates before it makes the privileged client and runs one database function. No action takes a contractor's id.
- **Existing pages** (Case Studies, Review and Send, readiness) read the library only when the switch is on, with the contractor's own session.
- **One check ignores the switch on purpose.** The proposal builder always resolves saved ticks through the shared resolver. Off, or with the tables missing, it is given no library rows, so a saved `lib:` tick cannot be honoured and publication is refused.

### Library screens

- **List** on the Case Studies page (`library-panel.tsx`): each case study with its state in words (Draft: clients can't see this yet / Approved / Approved, with changes not yet approved / Archived), archive and bring back, the contractor's kinds of work with add, rename, archive and bring back, and "start a new version" for older case studies.
- **Editor** (`library/case-study-editor.tsx`): only the job name is required. Kinds of work, what you did, what it meant, where, how long are optional. Client and price are under a closed "More, if you want" and are off until chosen. One explicit Save draft. A status line always says Saved, Changes not saved, or what went wrong. Leaving with unsaved typing asks first.
- **Check and approve**: only when there is nothing unsaved. It fetches the saved copy and current kinds of work again, shows the approved copy that would be made, says in words whether the client is mentioned and a price shown and the order of the kinds of work, and needs a tick. The revision sent is the one that check was loaded at.
- **The existing older editor is not edited at all.** With the switch on it sits under an "Older case studies" heading. Its whole-list save, stale-tab and positional risks are exactly as before and are not fixed or frozen here.

### The two-call save (F2)

`saveStudy` in `src/lib/case-library/service.ts`:

1. Reads the saved copy first, with the contractor's own session.
2. If the revision has moved: **already saved** only if the wording, the client and price choices, and the kinds of work all match; otherwise **conflict**, returning the latest.
3. Calls the wording function only if the wording differs, and the tags function only if the tags differ, chaining the returned revision. Nothing differing calls nothing.
4. After a call that fails without an answer it reads again and reports what it can see: **saved**, **partial**, or **unknown**. It never says "nothing changed" after a call that may have landed.

On the screen (`editor-state.ts`): one save at a time; the returned revision is taken at once; what was *sent* becomes the saved copy, so typing during a save stays as an unsaved change; a reply from anything but the current save is ignored; no refusal clears what was typed. After a conflict the contractor chooses "Keep what I typed" or "Use the saved version instead".

### Review and Send (F3)

- `buildProposalPublicationSnapshot` takes one optional input, the contractor's library rows, and always resolves case studies through `resolveSelectedCaseStudies`. A selection that cannot be sent stops a real publication with a plain message; the browser preview shows no case studies rather than a short list.
- The review page hands the preview the contractor's **approved, unarchived** copies, plus status only (no content) for ticked ones that cannot be sent, plus a separate count of unapproved ones. The draft column is never read for a proposal.
- `publishProposalAction` reads the same thing again after its existing editability check. The existing content-hash comparison then refuses a send whose case studies differ from what was previewed.
- "Relevant experience" keeps its older list as it was and adds: approved library case studies to tick; any ticked one that cannot be sent, with why and an **Untick it** button; the real count; and plain notes. A new required readiness item appears only when something chosen cannot be sent.
- Nothing is ticked or unticked automatically. An older case study and a new version started from it are both offered, labelled "new version of an older case study above", and ticking both says the job would appear twice.

### Starting from an older case study (F4)

The server reads the older entry itself and builds a draft with the client hidden, no price shown and no pictures. The database function then reads the entry again and records its place and a fingerprint of what it read. The two reads can differ; the fingerprint is a reference for noticing later drift, not a statement that the draft matches. The older entry is not changed. No screen claims an older entry has pictures; the page states only that new case studies cannot hold pictures yet.

### Readiness

With the switch on, "Case studies" counts titled older entries plus **approved** library case studies. Drafts never count; drafts only says "not approved yet". With the switch off the wording is exactly as before.

## 3. Changed files

Edited (13): `DEVELOPMENT.md`; `scripts/test-case-library-sql.sh`; `e2e/import-fixture/guard.test.ts`; `src/lib/proposal-publication.ts`, `proposal-readiness.ts`, `proposal-review.ts`, `company-readiness.ts`; `src/lib/case-library/contract.test.ts`; `proposal/actions.ts`, `proposal/page.tsx`, `proposal/review-send-client.tsx`; `settings/case-studies/page.tsx`; `settings/profile/readiness/page.tsx`.

New: in `src/lib/case-library/`: `gate.ts`, `store.ts`, `service.ts`, `messages.ts`, `status.ts`, `past-jobs.ts`, `proposal-read.ts`, `editor-state.ts`, `__fixtures__/fake-library.ts`, and five test files. In the app: `library-actions.ts`, `library-panel.tsx`, `library/case-study-editor.tsx`, `library/editor-host.tsx`, `library/new/page.tsx`, `library/[id]/page.tsx`, `proposal/past-jobs-extras.tsx`, and three test files. Fixture: `e2e/import-fixture/app/case-library/*` and `case-library.fixture.ts`. Evidence under `docs/evidence/stage2-tranche-2g4/client/`.

Not touched: the migration, the accepted resolver, content, labels and legacy modules, the older editor and its save action, storage, AI, and `src/app/(marketing)/`.

## 4. Verification actually run

| Command | Result |
| --- | --- |
| `npx vitest run` | 88 files, 1,770 passed, 4 skipped (pre-existing skips). 1,558 at the base |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, the same count as the base |
| `npm run test:case-library-sql` | pass, 179 assertions (171 at the base) |
| The five other SQL suites, unmodified | pass |
| `bash scripts/test-replay-bootstrap.sh` | pass |
| `npm run e2e:import-fixture` | 21 of 21 across desktop, phone and keyboard: 18 existing, 3 new. This run builds the application, so the production build compiled |

New unit tests by file: service 46, actions 77, proposal wiring 32, publish 12, editor state 17, boundary 14, reads 9, screens 8. The accepted contract tests are 99 (three "not wired" tests were removed and replaced by the boundary tests, because the foundation is now deliberately wired).

**Old-only parity.** Before writing the permanent tests I compared the new builder against the accepted one from `63ca10f` (copied in temporarily, then removed) over 60 combinations of stored lists and selections, including shared ids, an id that is another entry's place, untitled entries, and malformed inputs. 57 produced identical canonical JSON, content hash and snapshot hash. The 3 that differ are the same case: a saved value beginning `lib:` that matches no older entry. The accepted code silently ignored it; the new code refuses to publish. That is the intended guard, and no such value can have been saved by the product before this candidate. The representative proposal's two hashes from the accepted code are pinned in a permanent test.

**What the unit tests show, against the brief's list:**

- *Every action*: signed out, nothing is read or created; switched off (six values), refused straight after sign-in; switched on, sign-in comes before any privileged client; invalid input stops before the privileged client; an id slipped into the input cannot redirect a write; every database call carries the session's contractor.
- *Save*: only what differs is called, with the revision chained; a no-change save calls nothing and does not disturb an approved case study; double press; stale tab; a change landing between read and write; wording saved and tags refused; a lost answer after the wording landed and after it did not; the same for tags; a failed follow-up read; functions missing.
- *Tenancy*: another contractor's case study and kind of work are "not available" for all six actions, with nothing about them in the answer.
- *Approval*: what is stored equals what was shown; refused after a rename made since the check was loaded; naming needs agreement; a lost answer is "approved" only if the saved copy says so.
- *Proposal*: preview and publication hash equal for a library case study; a hidden client's name and an unshown price are absent from the snapshot; re-approval between preview and send is refused as changed; an unapproved edit changes nothing sent; switched off, tables missing, gone, unapproved, archived, unreadable, foreign: all refuse and all show a reason; an accepted project is refused before the library is read.
- *Counts*: seven older ticked is six shown and now says so; seven older plus one new is blocked with the real numbers; one tick matching two older entries counts as two; a repeated library tick is one; a `lib:`-prefixed older id keeps its meaning unless a library row also answers to it, which is then ambiguous; a bare id is always an older tick; an older entry removed or moved after a new version was started leaves the new version unaffected and claims no link.

**SQL additions**: the reads the pages make, as the contractor's own role, return exactly their own rows in the shape asked for, and return nothing when another contractor asks for them by owner id or by row id.

**Browser fixture** (`case-library.fixture.ts`), on the real screens with the real service over an in-memory library, at 1280×800, 390×844 touch, and keyboard only: add a past job; save; a failed save keeping the words and saying honestly it was not confirmed; a lost answer found to be saved; a change made elsewhere, with the typed text kept and the other save not overwritten; the leave-with-unsaved warning on and off; check and approve, refused without the tick; naming a client blocked until agreement; the list's status after a kind of work is renamed; a new version from an older case study with the client left out; ticking for a proposal with the six limit and its numbers; a chosen study archived elsewhere staying ticked, blocking send, and clearing with Untick; the library switched off with a library tick saved; and the tables missing. No sideways scroll, no control under 44 px and no serious accessibility finding in the new parts at any checkpoint; all 41 controls reached by keyboard showed focus.

**I checked that the tests bite** by breaking the code three times and restoring it byte for byte: removing the refusal to publish an unsendable tick failed 15 tests; removing the switch from the actions failed 49; replacing the follow-up read after a lost answer with an assumption failed 2.

## 5. Limits of this evidence

- **Not a hosted or authenticated run.** The fixture has no sign-in, no Supabase and no network. Sign-in and the switch are in the real pages and actions, which the fixture does not use; they are covered by unit tests with a mocked session.
- The fixture's publish is a stand-in: the application's own builder, a fresh read, the same hash check. The real action is exercised by unit tests, not in a browser.
- The real Supabase queries in `store.ts` are tested against a recording stand-in for the client and, as SQL, against a real local Postgres. They have not run against a hosted data API.
- The review screen as a whole was not re-measured for size and accessibility; only the library's part of it was.
- The approval preview uses the proposal's headings and exactly the values a proposal would carry (it goes through the resolver), but it is its own small layout, not the proposal document component itself.
- The hosted journey is untouched and remains configuration-blocked for the earlier reason. No model, provider or launch-readiness claim is made.

## 6. Residuals

- **Unchanged risks, stated plainly:** the older editor still overwrites the whole list; a signed-in session can still write the older list directly; a case study without an id is still identified by position; a positional tick can still drift. None is fixed or frozen here.
- Wording and tags are two calls, not one transaction. A refusal or lost answer on the second is reported as partial or unknown, never hidden.
- The parity difference in section 4: a pre-existing saved value that begins `lib:` and matches nothing would now block publication until unticked. I know of no way the product could have saved one.
- No delete for library case studies (archive only), no reordering of kinds of work, no grouping or filter chips on the review screen.
- The snapshot gains no new fields, so it does not record which approved revision a case study came from. The approved text is there by value.
- For an older-only proposal the review screen is unchanged, with two exceptions that apply whatever the switch says, and both are true statements: when the ticks match more than six older case studies a line now says only the first six are shown, and when one tick matches more than one older entry a line says so.
- With the switch on and the library readable, readiness says "ready to use" where it said "saved".
- An editor page left open across a deployment that turns the switch off will have its saves refused with a plain message; what was typed stays on the screen.

## 7. Held for the owner before rollout

Not requested now, and none decided by this build: turning the switch on anywhere real, and applying the foundation migration there first; launching before the library can hold pictures; whether an older case study and its new version are both selectable (built as a provisional recommendation); client hidden and no price by default; unreviewed older case studies staying selectable; the limits of 12, 50, 6 and 6.

## 8. Not done

No push, PR, merge or deploy. No hosted read or write, migration, secret, provider call or dependency. No schema, storage, AI, image, freeze or proposal-layout work. Frozen worktrees, including `63ca10f`, are unchanged. One blocked command is recorded for completeness: a directory removal I attempted during harness setup was refused by a safety check before it ran; nothing was removed, and the directory was never needed.
