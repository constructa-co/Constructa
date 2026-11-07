# Stage 2G.4 (G4B1a): first-review reconciliation and the save-and-next repair

Reconciles Kimi's first exact review of the guided-basics candidate and makes one further bounded change: a confirmed "Save and next" now stays on its question when something typed during the save is still unsaved. No schema, SQL, grant, storage, AI, dependency or hosted change. Fixture and unit evidence only. Not pushed, merged or deployed. For final delta review; I am not approving it.

Written 8 October 2026 by the primary builder (Claude).

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-guided-advance-repair` |
| Branch | `claude/stage2g4-guided-advance-repair` (local only) |
| Base | `cc5d5a02ea2428213a79bfac2c173bafcc1d875b` (the save-then-leave repair, unchanged in its own worktree) |
| Before that | `9c1a16fc6cc0d5a08a45a3ddc8dca74f67050dcb` (the candidate Kimi reviewed, unchanged in its own worktree) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-guided-advance-repair.patch` (this commit only, on top of `cc5d5a0`) |

The three heads are a chain: `18b49bd` → `9c1a16f` (basics) → `cc5d5a0` (leave repair) → this head.

## 2. The first review, point by point

Kimi's review (`/tmp/constructa-stage2g4b1a-kimi-code-review.md`) of `9c1a16f`: revise for one P1; everything else verified sound. The P1 has several parts. Each is taken separately, and tested fact is kept apart from the reviewer's wording.

| Part of the finding | Tested fact | Disposition |
| --- | --- | --- |
| **"Save, then go" leaves with newer typing unsaved**, and the effect pushes without checking. | True at `9c1a16f`. Reproduced by the integrator, by Kimi and by me. Real loss of typed input. | Repaired at `cc5d5a0`. Kept unchanged here. |
| **"Next" has "that typing abandoned when the screen advances".** | **Not as worded.** At `cc5d5a0` the screen does move on, but the typing stays in the same draft, is counted as unsaved, is named in the status line, is sent by the next save, and blocks leaving. The integrator's `G4B1A-NEXT-NEW-TYPING-REPRO.cjs` shows exactly that: `dirty: true`, typed text present, `leave: null`. **This is an automatic move that puts still-unsaved typing out of sight, not demonstrated data loss.** | Changed here anyway (section 3), because moving away from what someone is typing is wrong on its own terms and is inconsistent with the leave rule. |
| **The no-request branch can set "leave" and "an edit can land before the effect".** | No such window exists at `cc5d5a0`. See section 4. | No code change. Tests added that put an edit, a move, a conflict choice, a stray reply and two saves after a no-request leave and find the state unchanged. |
| **`useUnsavedGuard` "only covers document unloads".** | **Not so.** `src/lib/use-unsaved-guard.ts` (unchanged) registers a capture-phase click listener that asks before following any plain link, as well as `beforeunload`. What it does not cover is navigation made by code, which is the leave effect. | Nothing to rewrite. The leave effect is covered by its own check. |
| **Suggested defence: read dirtiness from a ref in the effect and clear "leave".** | Considered. See section 4 for why the existing defence is equivalent and why I did not add a second mechanism. | Not added. Explained and tested. |

Everything Kimi listed as verified sound is unchanged by this commit.

## 3. The change: "Save and next" stays when newer typing is unsaved

**Before (`cc5d5a0`).** Press "Save and next", keep typing while the save is on its way, the save is confirmed: the screen moved to the next question. The newer typing was kept and unsaved, but no longer in front of the contractor.

**After.** The same sequence stays on the question it was on.

- What was **sent** is saved, and the saved copy and the returned revision are held.
- What was typed since is exactly as typed, unsaved, and named in the status line.
- A plain line says: "Your earlier answers were saved. What you typed after that isn't saved yet, so this question is still open."
- Nothing is sent again automatically. Nothing is discarded.
- Pressing "Save and next" again, with nothing typed meanwhile, saves and moves on.
- It applies whatever was changed during the save: the same answer, another answer, kinds of work, the client choices.
- It applies to the very first save too: the case study is created, the screen stays on the job name, and the next save is a save, not a second create.

**In the rules (`guided-state.ts`).** One line now decides both cases. When a confirmed reply arrives with anything unsaved, the screen neither moves on nor leaves; it records `moveHeld` or `leaveHeld`. Only with nothing unsaved does it move or leave. There is one place that moves the screen after a save and one that sets "leave", both after that check; a boundary test pins this.

**Unchanged.**

- Moving by hand (Back, a jump) while a save runs still cancels the automatic move; the screen is where the contractor went and nothing is held.
- Failed, conflict, partly saved and not known replies stay and keep the typing, and are not described as an earlier save having worked.
- With nothing to save, "Save and next" moves without a request.

## 4. The leave effect: why no second mechanism

Kimi's concern is an edit arriving between "leave" being set and the effect running. At `cc5d5a0` and here that order cannot produce a leave with unsaved typing, for three reasons that hold together:

1. **"Leave" is only ever set from a state with nothing unsaved.** After a save: only when the replied editor is clean. Without a request: only when `planSave` has just found nothing to save in that same state.
2. **Once "leave" is set, the rules accept nothing more.** The reducer returns the same state for every later action. An edit queued behind it cannot make the state unsaved, because it is not applied. React applies queued actions to a reducer in order, so an edit queued **before** the reply is applied first, the reply then finds unsaved typing, and "leave" is never set.
3. **The effect asks again anyway.** It pushes only when `mayLeave(state)` holds for the state it rendered (leave decided, nothing unsaved, no save running), and at most once. The form is inert from that render.

A ref read inside the effect would be reading the same fact at the same moment. Clearing "leave" from the effect would add a second writer of that flag. I could not construct an order that gets past the three above, so I did not add it.

**Tested, not only argued.** For both targets: a no-request leave followed by an edit, a tag change, a move, "keep my changes", "stay", a stray reply and two further saves leaves the **identical** state object, still clean, with no request made and the stored copy untouched. And for an edit either side of the reply: there is no order in which "leave" is set and something is unsaved.

**What is left, plainly:** a keystroke that arrives in the instant after leaving has been decided, on a screen with everything saved, is not applied and the page goes. That is one keystroke typed into a page that is already going, not text that had been typed and was waiting. It is in the residuals.

## 5. Reproduction, before and after

| | `cc5d5a0` | This head |
| --- | --- | --- |
| Integrator's `G4B1A-NEXT-NEW-TYPING-REPRO.cjs`, unmodified, read only | `screen: value_added`, `dirty: true`, typed text present, `leave: null` | Same script pointed at this worktree: `screen: delivered`, `dirty: true`, typed text present, saved text "Sent text", `leave: null` |
| Browser, 5-second delayed answer, type during "Save and next" | With the earlier rule put back for one run: the journey fails at the new step, because the screen had moved on | Stays on the question, shows the line, keeps the typing; desktop, phone and keyboard |

The script is a pure interleaving of the rules. The browser runs are the fixture harness. Neither is a hosted run.

## 6. Changed files

`src/lib/case-library/guided-state.ts` (the rule and `moveHeld`), `guided.ts` (one message), `…/library/guided-capture.tsx` (one line to show it); tests in `guided-state.test.ts` and `boundary.test.ts`; one new step in `e2e/import-fixture/guided.fixture.ts`; one new pair of screenshots and the three results files; this report; a pointer added to `GUIDED-LEAVE-REPAIR-REPORT.md`.

No diff against the base in: `supabase/`, `scripts/`, `service.ts`, `store.ts`, `content.ts`, `editor-state.ts`, `messages.ts`, `gate.ts`, `library-actions.ts`, `use-unsaved-guard.ts`, the older case-study editor.

## 7. Verification actually run

All on the final code, after the last source change.

| Command | Result |
| --- | --- |
| `npx vitest run` | 92 files, 2,005 passed, 4 skipped (1,984 at the base; 21 new) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, unchanged |
| `npm run test:case-library-sql` | pass, script unmodified |
| `E2E_EVIDENCE=1 npm run e2e:import-fixture` | 24 of 24 across desktop, phone and keyboard, including the production build |
| Integrator's Next reproducer on `cc5d5a0` and on this head | section 5 |

**New state tests (21, in `guided-state.test.ts`).**

- Six kinds of change during a "Save and next": stays on the exact question, change kept and unsaved, saved copy equals what was sent, returned revision held, one request; then an explicit second press moves on with two requests in all.
- The same for an "already saved" reply.
- The integrator's exact interleaving.
- Nothing typed, or typed and put back: moves on.
- Moving by hand during the save: nothing held, typing on the new screen kept.
- Conflict, not known, not available, each with typing during the save: stays, nothing held.
- Partly saved: stays.
- How a held move is put down; typing again during the second save holds again.
- First create with the name typed further during it: one case study, then a save.
- Nothing to save: moves with no request.
- No-request leave, both targets, with seven kinds of later action: identical state.
- An edit either side of the reply: never "leave" with something unsaved.

**Boundary (existing test extended).** The dirty check comes before the only line that moves the screen and the only line that sets "leave".

**Browser (one new step, 3 projects).** With a 5-second delayed answer: Save and next; type more while it says "Saving…"; still on the same question; the line shows; the box holds the newer text; the status names it as unsaved; what was sent is what is stored and nothing more was written. Then a second press moves on and stores the newer text with exactly one more write. The existing delayed steps for both leave targets, and the rest of the journey, are unchanged and pass.

**The tests bite.** Each change restored afterwards and the file compared byte for byte.

| Change | Fails |
| --- | --- |
| "Save and next" moves on whatever is unsaved (the `cc5d5a0` rule) | 12 unit tests; and in the browser the new step fails |
| The rules accept input once leaving is decided | 5 |
| Moving by hand no longer cancels the automatic move | 3 |

## 8. Residuals

- **One keystroke after a clean leave is decided** is not applied (section 4).
- **Once leaving is decided the form does not unlock.** If the next page were very slow, the contractor sees "Saved. Opening…" and a form that does not respond.
- **"Go without saving" while a save is still running** goes at once, by the contractor's choice. Whether that save landed is then shown only by the next page.
- **The delayed-answer browser steps depend on typing within a 5-second delay.** A much slower machine could type too late; the step would then fail, not pass wrongly.
- **A second copy after an unconfirmed first create** remains possible, stated on screen, and needs a database function change to prevent.
- **No hosted or authenticated run.** Sign-in and the switch are unit-tested on the real pages, not exercised in the browser.
- **No real phone keyboard.** The phone project is a touch viewport.
- **The Back-button guard and the address change after the first save** were tried in Chrome only.
- The older editor's whole-list save and positional identity, and the other earlier residuals, stand.

## 9. Not done

No push, PR, merge or deploy. No schema, SQL, grant, storage, AI, provider, secret or dependency. No hosted read or write. The depth design (1b) is not implemented and nothing here depends on it. `9c1a16f`, `cc5d5a0` and the other frozen worktrees are unchanged. `.next`, `test-results` and the copied harness are absent from the worktree.
