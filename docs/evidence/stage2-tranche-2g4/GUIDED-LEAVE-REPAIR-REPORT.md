# Stage 2G.4 (G4B1a): save-then-leave repair

A bounded repair to the guided-basics candidate after the integrator reproduced "Save, then go" leaving with newer typing unsaved. No schema, SQL, grant, storage, AI, dependency or hosted change. Fixture and unit evidence only. Not pushed, merged or deployed. I am not approving it.

Kimi's first code review of the original candidate had not arrived when this was frozen (no report at `/tmp/constructa-stage2g4b*` beyond the design review). **Its findings are not reconciled here.** That is owed before the final repaired-head review.

Written 8 October 2026 by the primary builder (Claude).

> **Followed by `GUIDED-ADVANCE-REPAIR-REPORT.md`.** This report says "Save and next" was looked at and left as it was, and that Kimi's first review was not yet reconciled. Both are superseded: the first review is reconciled there, and a confirmed "Save and next" now stays on its question when newer typing is unsaved.

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-guided-leave-repair` |
| Branch | `claude/stage2g4-guided-leave-repair` (local only) |
| Base | `9c1a16fc6cc0d5a08a45a3ddc8dca74f67050dcb` (the guided-basics candidate, unchanged in its own worktree) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-guided-leave-repair.patch` |

## 2. The defect

On the guided screen, "Save, then go" starts a save and remembers where to go when it is confirmed. The boxes stay usable while the save is on its way. If the contractor typed anything in that time, the confirmed reply still set "leave", and the screen's navigation effect pushed the new page without looking. The new typing was dropped with no one choosing that.

The fault was mine, in two places: the rules treated "the save was confirmed" as "everything on the screen is saved", and the navigation effect trusted that without checking. A confirmed save confirms the copy that was **sent**.

My own candidate report said typing during a save "is kept and is unsaved afterwards". That was true for "Save and next" and false for "Save, then go".

## 3. Reproduction, before and after

**Before.** The integrator's `G4B1A-SAVE-LEAVE-RACE-REPRO.cjs`, unmodified, against the frozen candidate (read only; that worktree is still clean):

```
dirtyAfterReply true · leaveRequested "form" · typedText "New typing after the request started" · savedText ""
```

**After.**

1. The same script pointed at this head fails at its own assertion that a leave was requested: `actual: null, expected: 'form'`.
2. `G4B1A-SAVE-LEAVE-RACE-REPRO-AFTER.cjs` (beside the original, same interleaving):

```
dirtyAfterReply true · leaveRequested null · leaveHeld "form" · mayNavigate false
typedText "New typing after the request started" · savedText "" · heldRevision 2
```

3. **In a real browser**, with the new fixture step and a 5-second delayed server answer: on this head the page stays, shows the message and keeps the typing, on desktop, phone and keyboard. With the old behaviour put back for one run (section 6), the same step fails because the page had gone.

The scripts are pure interleavings of the rules. The browser runs are the fixture harness. Neither is a hosted run.

## 4. The repair

**The rules (`guided-state.ts`)**

- When the reply to a "save, then go" is confirmed, the screen leaves **only if nothing is unsaved at that moment**. Otherwise it stays, and records where the contractor had asked to go (`leaveHeld`).
- Staying keeps everything: the typed text exactly as typed, the saved copy as what was sent, and the revision the reply returned.
- Nothing is saved again automatically and nothing is discarded automatically.
- The held leave is put down by "Stay here", by moving to another screen, or by starting another save. Typing on does not put it down.
- Moving by hand while the save runs already gave up the leave; that is unchanged and now tested.
- Once leaving **has** been decided with everything saved, the rules accept nothing further: no edit, move or save. A new save cannot start.
- `mayLeave(state)`: leave is set, nothing is unsaved, and no save is running.

**The real navigation (`guided-capture.tsx`)**

- The effect no longer pushes because "leave" is set. It asks `mayLeave` every time, so unsaved typing or a running save stops it whatever was decided earlier. It pushes once.
- When a leave is held, the existing "Before you go" panel opens with the line: "Your earlier answers were saved. What you typed after that isn't saved yet, so you're still here." It lists what is unsaved and offers the same three choices: Save, then go; Go without saving; Stay here.
- "Go without saving" is still there and still the contractor's choice.
- Once leaving is decided, the form is inert and the status reads "Saved. Opening…", so nothing can be typed into a page that is already going.

**Not changed:** the held revision and its check, the conflict choices and their merge, untouched-field preservation, the unconfirmed first create, known-id retry, the routes' sign-in and switch, approval, proposal choices, the Back-button guard. No text handling, no 1b, no pictures, no older-editor change. `supabase/`, `scripts/`, `service.ts`, `store.ts`, `content.ts`, `editor-state.ts`, `messages.ts`, `gate.ts` and `library-actions.ts` have no diff against the base.

**"Save and next" was looked at and left as it is.** Typing during that save moves on to the next question with the typing kept as unsaved and named in the status line. Nothing leaves the page and nothing is lost. If the reviewer wants it to stay on the question instead, that is a small further change.

## 5. Changed files

`src/lib/case-library/guided-state.ts`, `guided.ts` (one message), `…/library/guided-capture.tsx`; tests in `guided-state.test.ts` and `boundary.test.ts`; `e2e/import-fixture/guided.fixture.ts`; one new pair of screenshots and the three results files under `docs/evidence/stage2-tranche-2g4/guided/`; this report; a pointer added to the top of `GUIDED-BASICS-BUILDER-REPORT.md`.

## 6. Verification actually run

| Command | Result |
| --- | --- |
| `npx vitest run` | 92 files, 1,984 passed, 4 skipped (1,950 at the base; 34 new) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, unchanged |
| `npm run test:case-library-sql` | pass, script unmodified |
| `E2E_EVIDENCE=1 npm run e2e:import-fixture` | 24 of 24 across desktop, phone and keyboard, including the production build |
| Integrator's reproducer on the frozen candidate | reproduces |
| Same, and the after variant, on this head | no leave; typing kept |

All of the above were run on the final code. The full unit suite, typecheck, lint, SQL check and all 24 browser fixtures ran after the last source change.

**New state tests (33, in `guided-state.test.ts`).** For each target (the full form and the list):

- six kinds of change made while the save runs (job name, wording, kinds of work, how the client is shown, the agreement to be named, whether a price is shown): no leave, the change kept exactly and unsaved, what was sent saved, the returned revision held, one request only; then a deliberate second save does leave;
- the same when the reply is "already saved";
- nothing typed: leaves as before;
- typed and put back before the reply: nothing unsaved, so it leaves;
- conflict, not known and not available, each with and without new typing: stays, no leave, none held;
- partly saved: stays.

And once each: the integrator's exact interleaving; moving by hand during the save; how a held leave is put down; typing again during the second save holds again with no automatic save or discard; nothing is accepted once leaving is decided; `mayLeave` refuses with unsaved typing or a running save; a first create with more typed while it runs.

**Boundary (1).** The screen navigates after a save in one place only, through `mayLeave`, once; the only other navigation is "Go without saving"; the form is inert once going.

**Browser (in the guided journey, 3 projects).** With a 5-second delayed answer:

- to the list: Save, then go; type more while it says "Saving…"; the page stays, the message shows, the typing is in the box, the status says what is unsaved, and what was sent is what is stored. Stay here writes nothing. A second Save, then go, with nothing typed, leaves and stores the newer text.
- to the full form: the same, then "Go without saving" opens the full form, writes nothing, and the full form shows the saved answer.

One later step of the journey was adjusted because these steps changed what was saved and where the browser had been; its assertions are otherwise the same.

**The tests bite.** Each change was restored afterwards and the file compared byte for byte.

| Change | Fails |
| --- | --- |
| The rules leave whatever is unsaved | 19 unit tests |
| `mayLeave` ignores unsaved typing | 1 |
| The rules still take input once going | 2 |
| All three together, in the browser (desktop) | the journey fails at the new step: the message is not found because the page has gone |

## 7. Residuals

- **Kimi's first review is not reconciled.** See the top of this report.
- **Typing in the moment between the reply and the new page appearing.** Once leaving is decided the form is inert, so nothing can be typed. If the new page were very slow to arrive the contractor would see "Saved. Opening…" and a form that does not respond. It does not time out or unlock.
- **"Go without saving" while a save is still running** goes at once, as before. The panel says a save is still running. Whether that save lands is then not shown to the contractor; the list or full form will show what is saved.
- **"Save and next" still moves on** when something was typed during the save (section 4). No loss; noted for the reviewer.
- The delayed-answer browser steps rely on a 5-second server delay to type during the save. They passed on all three projects in both runs made. A much slower machine could type too late; the step would then fail, not pass wrongly.
- All residuals in `GUIDED-BASICS-BUILDER-REPORT.md` stand, including the duplicate risk after an unconfirmed first create, no hosted run, no real phone keyboard, and the Back-button guard being tried in Chrome only.

## 8. Not done

No push, PR, merge or deploy. No schema, SQL, grant, storage, AI, provider, secret or dependency. No hosted read or write. The frozen candidate `9c1a16f` and the other frozen worktrees are unchanged. The after-variant reproducer was written to the hand-off directory beside the original, outside the repository. `.next`, `test-results` and the copied harness are absent from the worktree.
