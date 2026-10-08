# Profile case-study lost-update repair (F1a): builder report

A bounded repair of one confirmed data-loss path. It is not the case-study library. No migration, table, grant, policy, storage or hosted change. No provider call. Candidate for independent code review; not pushed, merged or deployed.

Written 8 October 2026 by the primary builder (Claude). The design revision is a separate document (`STAGE2G4-CLAUDE-DESIGN-REVISED.md`, outside this repository) and is not part of this candidate.

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-profile-case-study-loss-fix` |
| Branch | `claude/profile-case-study-loss-fix` (local only) |
| Base | `82c6a4f003bdc8165e81c185c028f9781d641b18` |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/profile-case-study-loss-fix.patch` |

## 2. The defect, as it was at the base

Two things together:

- `updateProfileAction` wrote `profiles.case_studies` on every profile save: the posted list if there was one, and **an empty list if the field was missing** (`settings/profile/actions.ts:44-54` at the base).
- The Company Profile form carried its own second case-study editor, initialised from the page load, and posted its copy on every save (`profile-form.tsx:279-280, 354, 696-737` at the base).

So saving the profile from a page loaded before a case study was added on the Case Studies page replaced the stored list with the older copy.

## 3. What changed

| File | Change |
| --- | --- |
| `src/lib/profile-update.ts` (new) | `profileUpdateFromForm(userId, formData)`: the action's field list, moved here unchanged, without case studies. Shared by the action and the fixture harness. |
| `settings/profile/actions.ts` | `updateProfileAction` builds its payload with that function. It no longer reads a `case_studies` field or defaults one. Authentication, the upsert, the error return and the revalidation are as before. |
| `settings/profile/profile-form.tsx` | The duplicate editor is removed: the card component, its state, its "Add Case Study" buttons, its photo upload and the posted field. In its place is a short notice, "Case studies are added and changed on their own page. Saving this profile does not change them.", and one link to `/dashboard/settings/case-studies`. A `save` prop, defaulting to the real action, lets the fixture stand in for the save. Unused icon imports removed. |
| `update-profile.test.ts`, `profile-form.test.ts` (new) | 16 and 7 tests. |
| `e2e/import-fixture/app/profile/*`, `profile.fixture.ts` (new), `guard.test.ts` | Fixture harness and browser spec; the harness guard test covers the new entry points. |

Not changed: the dedicated case-study page, its client and its save action; onboarding; every other profile field; the rewrite-wording actions in the same file. `updateProfileAction` is used only by the profile form.

**Why the payload moved to its own file.** A `"use server"` file can export only async functions, and the fixture needs to apply exactly the rule the action applies. The move is verbatim: the same 24 fields with the same defaults, plus `id`.

**Why the editor was removed, not just ignored.** Leaving it on screen while the server ignored it would report "Profile saved" for case-study edits that were thrown away.

## 4. Verification actually run

| Check | Result |
| --- | --- |
| New action tests | 16 pass |
| New form tests | 7 pass |
| The same 23 tests against the base's action and form | 14 fail, 9 pass. Files restored afterwards |
| `npx vitest run` | 78 files, 1,407 passed, 4 skipped (pre-existing skips) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings. None is in a file this change adds or edits |
| `npm run e2e:import-fixture` | 18 of 18 across desktop, phone and keyboard: the 15 existing and 3 new. This run builds the application, so the production build compiled. Build output and harness removed afterwards |

What the action tests show, calling the real action with a mocked, authenticated Supabase session whose upsert behaves like the real one (sent columns replaced, others left):

- With `case_studies` absent, empty, `[]`, a stale shorter list, a different list, malformed JSON, `null`, or a non-list: the upsert payload has no `case_studies` key, the stored list is unchanged, and the other fields save.
- The stale-page case directly: a study added after the page was loaded survives a profile save that posts the older list.
- The saved field set is exactly the previous set minus case studies. A posted `id` cannot redirect the save. Defaults are as before.
- A failed save returns the error, changes nothing and does not revalidate. A signed-out caller writes nothing. No privileged client is created.

What the form tests show: no editor, fields or stored case-study text is rendered even when the page is handed case studies; the notice and exactly one link are present; the link target is the existing page and is open in the cohort profile; the form's source no longer holds, posts or uploads anything for case studies; the rest of the form renders.

What the browser fixture shows, on the real form: no editor; the notice and link, at least 44 by 44 px, no sideways scroll, no serious accessibility finding in the notice; a case study added "elsewhere" after load is still stored after a profile save, and the form posts no `case_studies` field; a failed save says so; by keyboard the link is reachable and shows focus. Earlier-stage evidence images rewritten by the evidence run were restored from Git.

## 5. Limits of this evidence

- The fixture's save is a stand-in. It uses the application's own payload function and applies it to an in-memory row. It does not exercise authentication or the database; the unit tests cover the real action with a mock.
- The browser run checks the link's address, size and focus. It does not follow it: the page it leads to needs a signed-in session, which the fixture does not have.
- Only the new notice was measured for size and accessibility. The rest of the profile form is older and is not claimed to meet those checks.
- No hosted run.

## 6. What this does not fix

- **The dedicated editor still overwrites the whole list.** `saveCaseStudiesAction` takes whatever list the browser sends, unvalidated. Two tabs of the Case Studies page can still overwrite each other.
- **Direct writes.** Any signed-in session can still update its own `profiles.case_studies` through the data API. The `authenticated` role holds table-wide `UPDATE` on `profiles`.
- **Identity by position.** A case study without an `id` is still remembered in a proposal by its place in the list.
- **A browser tab still running the old bundle.** After deployment, an already-open profile page still shows the old editor and posts `case_studies`. The new action ignores it, so nothing is lost, but that tab will say "Profile saved" for a case-study edit that was not saved, until it is reloaded.
- Privacy, consent, image metadata, mutable pictures in sent proposals, disciplines: all remain design work.

One behaviour change to be aware of: a contractor who only ever edited case studies on the Company Profile form must now use the Case Studies page. It shows the same stored list and the same fields.

## 7. Not done

No push, PR, merge or deploy. No migration, table, grant, RLS or storage change. No admin privilege added. No hosted read or write, secret, provider call or dependency. No change to `src/app/(marketing)/`. Frozen worktrees are unchanged.
