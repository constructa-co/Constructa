# Stage 2G.4 (G4B1a): guided case-study basics. Builder report

An optional, phone-first way to add or fill in a past job by answering six plain questions, beside the full form. It writes the same draft through the same saves. Fixture and unit evidence only. Not pushed, merged or deployed, nothing hosted was contacted, and no schema, SQL, grant, provider, dependency or switch was added. For first independent review; I am not approving it.

Written 8 October 2026 by the primary builder (Claude).

> **Amended by `GUIDED-LEAVE-REPAIR-REPORT.md`.** After this candidate was frozen, the integrator showed that "Save, then go" could leave while something typed during the save was still unsaved. This report's statement that typing during a save "is kept and is unsaved afterwards" was true for "Save and next" and false for "Save, then go". The repair report is the current statement for leaving. The counts below are those of the first candidate.

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-guided-basics` |
| Branch | `claude/stage2g4-guided-basics` (local only) |
| Base | `18b49bd7d12adb9f5c6537f7bc4bf91752bf7cf2` (accepted approval-read repair, unchanged in its own worktree) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-guided-basics.patch` |
| Reconciled design | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/STAGE2G4B-CLAUDE-DESIGN-RECONCILED.md` (outside the repository) |

## 2. What was reconciled first

Kimi's C1 to C5 and the integrator's corrections, in the reconciled design. In short:

- **1a only.** Six questions, an optional client and price screen, a summary and resume. The follow-up questions (1b) are not built.
- **No text structure at all.** No lead-ins, joining, splitting or inferred answers. An answer is one draft field, saved exactly as typed. Nothing says who wrote any text.
- **Question 6 asks how long, not when.**
- **One switch**, the existing default-off `CONSTRUCTA_CASE_LIBRARY`. No second switch.
- **The existing reducer is reused only as the save-status machine.** Which screen shows and where a confirmed save leads is a small separate wrapper.
- **A save never fetches a newer revision to save over.** It sends the whole content with the revision the screen holds; if the saved copy has moved, that is a conflict the contractor resolves.

## 3. What was built

| File | What |
| --- | --- |
| `src/lib/case-library/guided.ts` (new, pure) | The questions, which field each one is, what counts as answered, what is unsaved, the check before a request, the summary. |
| `src/lib/case-library/guided-state.ts` (new, pure) | The wrapper round `editorReducer`: screen, where a confirmed save leads, the conflict choices, the unconfirmed first create. |
| `…/case-studies/library/guided-capture.tsx` (new) | The screen. |
| `…/library/new/guided/page.tsx`, `…/library/[id]/guided/page.tsx` (new) | Sign-in, then the switch, then an own-session read. The existing one reads at one revision with the accepted reader. |
| `library-panel.tsx`, `case-study-editor.tsx`, `editor-host.tsx` | One link each way. The editor's link shows only when nothing is unsaved. |
| Fixture harness | One new route for the guided screen; one control (`loseSaveAndLook`); the saved draft added to what the spec can read back. |
| Tests | Section 6. |

**Not changed (no diff against the base):** `supabase/`, `scripts/`, `service.ts`, `store.ts`, `content.ts`, `editor-state.ts`, `messages.ts`, `gate.ts`, `library-actions.ts`, the older case-study editor and its save. No server action was added. The guided screen imports exactly three existing ones: create, save, add a kind of work.

## 4. How it behaves

**Questions and fields**

| # | Question | Field |
| --- | --- | --- |
| 1 | What was the job? (required) | `title` |
| 2 | What kinds of work did this job involve? | tags |
| 3 | What did you do? | `delivered` |
| 4 | What did it mean for the client? | `value_added` |
| 5 | Roughly where? | `place` |
| 6 | How long did it take? | `duration_text` |
| + | Client and price (optional) | `client_display`, `client_text`, `client_named_ok`, `show_value`, `value_text` |

`work_type` belongs to no question and is never changed. Every other field belongs to exactly one.

**Saving**

- The case study is created by the first save of the job name. Until then no other question can be reached.
- A save sends the whole draft and the tag set with the held revision. Untouched fields go back exactly as loaded. The existing service still writes only what differs.
- Back, Skip, "Skip for now", "See all answers" and summary links make no request and clear nothing. So more than one answer can be unsaved. **A save writes all of them**, and the screen says which first ("Saving will also save your changes to: the place."). The status line always lists what is unsaved.
- The only way to remove an answer is to clear its box and save.
- "Save and next" moves on only for "saved" or "already saved". Invalid, conflict, partly saved, not known, unavailable, switched off and signed out all stay on the question with the typing intact.
- One request at a time. A reply that is not from the save now running is ignored. Typing during a save is kept and is unsaved afterwards. The returned revision is taken at once. If the contractor moves by hand while a save is running, the reply records the save but does not move the screen again.
- Over-long or malformed text is refused before any request, with the same rule the server applies, and **nothing is cut**. Boxes have no silent length limit; a count appears near the limit.
- One visible tidy-up: spaces at the very start or end of the job name are removed in the box when saving, because the accepted content rule refuses them. No other text is altered.

**Changed somewhere else**

- The save is refused and nothing is written. The revision held stays the old one until the contractor chooses.
- The latest saved copy is shown, including its client and price line.
- **"Keep my changes" keeps only the answers the contractor changed** and puts them on the latest saved copy. Anything they did not touch is the latest copy's. Nothing is saved by choosing.
- "Use the saved version instead" gives up what was typed and writes nothing.
- The full form's own "Keep what I typed" is unchanged.

**A first save that gets no answer**

- There is no id to look for, so it is **not** retried. The screen stops, says it could not confirm, offers the list in a new tab, and offers "It isn't there. Add it again" with the words "We can't promise that won't make a second copy."
- In the browser fixture the first attempt had in fact landed, and adding again made a second copy. The test asserts that plainly. This is the existing duplicate risk, stated, not fixed.
- With a known id it is different: trying again reads first and reports "already saved" without a second write. Both are tested.

**Coming back**

- The existing case study's guided route opens on a summary of what is saved, read at one revision with the contractor's own session.
- Skips and unsaved typing are kept nowhere. The summary says so. No browser storage is used.
- "Carry on" goes to the first of the six with no answer. It makes no claim about what was skipped.

**Leaving with something unsaved**

- Reload, tab close and any link on the page ask first (the existing `useUnsavedGuard`).
- The screen's own "Use the full form instead" and "Back to case studies" become a choice: save then go, go without saving, or stay. A save that fails does not go.
- The browser's Back button asks first.

**Client, price, approval**

- Same controls and defaults as the full form. Only the contractor's tick sets "agreed to be named"; choosing another option clears it.
- The guided screen cannot approve, archive or touch a proposal's choices. Finishing links to the full form, where the accepted check, shown-copy binding and revision check are the only way to approve.
- On an approved case study the questions change the draft only.

**Kinds of work**

- Nothing is pre-ticked. Only the contractor's own active kinds of work are offered. Nothing is suggested from the company interview, the profile, the job name or other case studies.

## 5. Verification actually run

| Command | Result |
| --- | --- |
| `npx vitest run` | 92 files, 1,950 passed, 4 skipped (1,854 at the base; 96 new) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, same as the base |
| `npm run test:case-library-sql` | pass, script unmodified (a no-change check; there is no new SQL) |
| `E2E_EVIDENCE=1 npm run e2e:import-fixture` | 24 of 24: the 21 existing, plus the guided journey on desktop, phone and keyboard. Includes the production build. |
| Guided journey alone, after the last change | 3 of 3 |

Order of runs, for honesty: the full 24 ran before one last small addition (the client and price line in the "latest saved version" panel). After it, the full unit suite, typecheck and lint were run again, and the guided journey was run again on all three projects. The other 21 browser fixtures were not re-run after that addition; it touches only the guided screen and `guided.ts`.

There is no separate `npm run build` line: the fixture run builds the application for production with the harness copied in. A plain build without the harness was not run.

## 6. Tests added

**`guided.test.ts` (26).** Order and wording; every draft field owned by exactly one question and `work_type` by none; limits equal the saved limits; no "when" in question 6; nothing asked that would have to be made up; what counts as answered (spaces are not, and nothing is trimmed); unsaved answers named in order; over-long or malformed text refused with its question and the text untouched; the summary shows answers exactly, and never says a client has agreed when they have not.

**`guided-state.test.ts` (37).** Run against the real service over the in-memory library, driving the rules exactly as the screen does.

- New: only the first question until created; no request without a name; created with the safe defaults; the name tidy-up is visible.
- Unconfirmed first create: no retry; adding again can make two (asserted); when it never landed, exactly one.
- Each text answer changes only its field, with `work_type`, consent, price and tags as they were; tags alone do not rewrite wording; a new case study has no tags whatever others have; naming a client never sets agreement, and the existing check refuses it; an approved copy and its revision are unchanged by a guided save.
- Moving about sends nothing and clears nothing; several unsaved answers go in one save; clearing and saving is the only removal.
- Stays put on: too long (no request), a server refusal, not known, partly saved, unavailable. A known-id retry reports "already saved" with one write.
- Changed elsewhere: refused with no write and the old revision still held; "keep my changes" with and without my own tag change; an agreement given elsewhere is not undone, and one I withdrew stays withdrawn; "use the saved version"; "being changed right now" saves nothing.
- One save at a time; typing during a save; moving by hand during a save; late replies.
- Coming back holds only what is saved.

**`guided-routes.test.ts` (23).** The two real pages: signed out goes to sign-in and reads nothing; switched off (five values) goes to the Case Studies page after sign-in and reads nothing; missing library says so; another contractor's id, a malformed id and an unknown id are "not available" with nothing of theirs shown; "being changed" shows no questions; archived is not opened; the read is revision, row and kinds of work, revision; the privileged client is never made and no database function is run.

**`boundary.test.ts` (+5), `library-screens.test.ts` (+5).** The screen imports only the three actions and names no approval, archive, older-version or proposal code; no browser storage, model or provider; no joining, splitting or replacing of text in the rules; one switch; the three leaving guards present; the page list is now four pages, all checked for sign-in then switch then read. Static renders of the first question, the summary, the approved line and both links.

**`guided.fixture.ts` (browser, 3 projects).** Entry link; no save without a name; unconfirmed first create; kinds of work; Back and Skip send nothing; two unsaved answers saved together; Enter moves on; a lost answer then one write; client named without the tick, refused at the existing check; resume from the summary with unsaved typing gone; both conflict choices; the leave choice with a failed save; the browser's Back button refused then accepted; an approved copy unchanged by a guided edit; the library missing. Nine checkpoints per project for sideways scroll, 44 px controls and serious accessibility findings: none. Keyboard project: 59 controls reached, all with visible focus.

**The tests bite.** Five changes to `guided-state.ts`, each restored afterwards: keeping the whole stale draft on "keep my changes" fails 3; moving on for any reply fails 8; not holding an unconfirmed create fails 1; not cancelling the move when the contractor moves by hand fails 1; no check before a request fails 2.

## 7. Limits and residuals

**Data loss or duplication that can still happen**

- **A second copy after an unconfirmed first create.** Stated on screen, demonstrated in tests, not prevented. Preventing it needs a change to the create function (schema), which is out of scope.
- **"Go without saving" and accepting the browser's leave prompt discard unsaved typing.** That is the choice offered.
- **"Keep my changes" when I changed the kinds of work replaces the latest set with mine.** It is not merged tag by tag. The panel shows the latest set before the choice.
- **Adding a kind of work from question 2 adds it to the contractor's list at once**, as the full form does, even if the job is then not saved.

**What this does not show**

- **No hosted or authenticated run.** Migration 110 is not approved for any hosted project and none was contacted.
- **Sign-in and the switch are not exercised in the browser.** The harness does not use the real pages. They are covered by the route tests in section 6.
- **No real phone keyboard.** The phone project is a viewport with touch. Controls are in normal page flow, which is asserted, but a device check is still owed.
- **The Back-button guard and the address change after the first save use the browser history directly.** They pass in Chrome in the fixture. They were not tried in Safari or Firefox.
- **The harness's guided page shows the questions even when the library is missing**, so the fixture's "library missing" step shows the save being refused. The real page shows "not available" and no questions; that is a unit test.

**Deliberate limits**

- Skips are not remembered. Unsaved typing is not kept between visits.
- No dates. No `work_type`. No follow-up questions. No wording help of any kind. The draft is the contractor's own words; the finish screen says so. This does not meet the premium AI wording intent and does not claim to.
- The Back-button guard keeps one extra history entry for the page while something has been typed.
- An archived case study cannot be opened for questions; the message is local to that page.
- Earlier evidence screenshots under `docs/evidence/stage2-tranche-2g4/client/` were left as they were. They predate the two new links.

**Unchanged and still open:** the older editor's whole-list save and positional identity, direct writes to the older list, two-call saves, the single-database assumption of the one-revision read.

## 8. Not done

No push, PR, merge or deploy. No schema, SQL, grant, storage, AI, budget feature, provider, secret or dependency. No 1b, pictures, G4C, banking, legal, website or brochure work. No hosted read or write. Frozen worktrees are unchanged. `.next`, `test-results` and the copied harness are absent from the worktree.
