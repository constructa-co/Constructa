# Stage 2G.4 (G4B1b): optional depth questions. Builder report

Three optional questions about a past job (anything tricky, what you did about it, what you do differently now), reached from a saved job's summary or finish screen. Each answer is typed as a note, added to the end of "What you did" by an explicit press, and saved by the ordinary save. Fixture and unit evidence only. Not pushed, merged or deployed; nothing hosted was contacted; no schema, SQL, grant, action, switch, provider or dependency was added. For first independent review; I am not approving it.

Written 8 October 2026 by the primary builder (Claude).

## 1. Pins

| | |
| --- | --- |
| Worktree | `/Users/robertsmith/Documents/GitHub/constructa-stage2g4-guided-depth` |
| Branch | `claude/stage2g4-guided-depth` (local only) |
| Base | `b22c905e4e80a52175e822729821ee0a9ae68890` (accepted basics, unchanged in its own worktree) |
| Commit | the single commit that adds this file |
| Patch | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g4-guided-depth.patch` |
| Reconciled design | `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/STAGE2G4B1B-CLAUDE-DEPTH-DESIGN-RECONCILED.md` (outside the repository, written before any code) |

## 2. What was reconciled first

**Kimi D1 (required).** My revised design said "`mayLeave` gains one condition". Against the accepted head that would deadlock: "save, then go" with nothing to save sets `leave` at once, a note is not part of the draft, and once `leave` is set the rules accept nothing. The page would neither leave nor let the note be cleared. Corrected as Kimi specified, with one combined fact used at four points (section 4).

**Kimi D2 (minor).** `present` stays literal. A lead-in after CRLF CRLF is not seen. That is documented in tests as an in-memory eligibility difference, together with the fact that makes it bounded: the existing content rule refuses a carriage return, so such text cannot be saved as it is. Nothing is normalised to make a test pass.

**The integrator's correction.** At `b22` the screen worked out a save plan from its own copy of the state, sent it, and separately told the rules a save had started. A refusal made only in the rules could still be followed by a request. Corrected by removing the screen's planner (section 5).

**One reading of the brief that I flag.** The brief asks that a confirmed "Save and next" be held by notes. I built: held when a note was **typed or changed while that save ran**. A note that was already there when the contractor pressed does not hold Next; it is kept, and the status line goes on naming it as not added. Leaving is stricter: any note at all stops it. Holding every Next for as long as any note exists anywhere would make each save need two presses. If the reviewer reads the brief the stricter way, it is a one-line change in the rules and one test.

## 3. What was built

| File | What |
| --- | --- |
| `src/lib/case-library/guided-depth.ts` (new, pure) | The three questions and their fixed lead-ins; `present`, `room`, `canAdd`, `add`; the note bound; which question follows which. |
| `src/lib/case-library/guided-state.ts` | `notes` in the state; `note/type` and `note/add`; `unsavedOrUnapplied`; the refusal at the start of a save-then-go; the reply rule; `mayLeave`; `requestOf`. |
| `…/library/guided-capture.tsx` | The screen sends only what `requestOf` reads from the state; both navigation guards take the combined fact; three depth screens; status, leave-panel and conflict-panel wording; the way in from the summary and the finish screen. |
| Tests | `guided-depth.test.ts` (new), additions to `guided-state.test.ts`, `boundary.test.ts`, `library-screens.test.ts`. |
| `e2e/import-fixture/guided-depth.fixture.ts` (new) | The browser journey. The harness itself is unchanged. |

**No diff against the base in:** `supabase/`, `scripts/`, `service.ts`, `store.ts`, `content.ts`, `editor-state.ts`, `messages.ts`, `gate.ts`, `guided.ts`, `library-actions.ts`, `use-unsaved-guard.ts`, the full form (`case-study-editor.tsx`), the older case-study editor, the fixture harness (`e2e/import-fixture/app/`), and the accepted basics journey (`guided.fixture.ts`).

The guided screen still imports exactly three actions: create, save, add a kind of work.

## 4. The contract as built

**One text.** "What you did" is `draft.delivered`, one string, shown whole in one box. There is no second copy, no "base", nothing retained per answer.

**Notes.** Three strings in memory for one visit. A note is typing that has not been added. It is never part of the draft, never sent, never called saved. It is "there" when it is not exactly empty; spaces count.

**A note changes in three ways only:** typing in its box; "Clear this box" (typing nothing); its own Add, which empties that one note. A save, any reply, Back, Skip, a jump and either conflict choice leave every note as it is. A new visit starts with none.

**Add.** Allowed only when `canAdd` says so. It puts `lead-in + note` on the end of the text after one blank line (no blank line if the text is empty), exactly as typed, and empties that note. It makes no request. The existing text is not altered in any way.

**`canAdd`, in order:** nothing to add (empty or only white space); a paragraph starting with that lead-in is already there; for "what did you do about it", no paragraph starting with the challenge lead-in; not enough room; otherwise ok. Room decides only when nothing earlier applies.

**Bounds.** A note may hold 5,000 characters; an edit that would take it over is refused whole and the note is left as it was. Room in the text is `5,000 − text − blank line − lead-in`, counted in code points. If the room shrinks after a note was typed, the note is kept and simply cannot be added.

**The combined fact, at four points (D1).** `unsavedOrUnapplied` = the draft is unsaved, or any note is there.

| Point | Rule |
| --- | --- |
| Starting a save-then-go | Refused with a named message if any note is there, whether or not there is anything to save. No request, no `leave`, nothing locked. |
| A confirmed reply | Leaves only with nothing unsaved and no note. Moves on only with nothing unsaved and no note changed during that save. Otherwise held, and held is not locked. |
| `mayLeave` and the navigating effect | `leave` decided, nothing unsaved, no note, no save running. One push. |
| Both navigation guards | Links, reload and the browser's Back button ask first when anything is unsaved or any note is there. |

`leave` can therefore only be set with every note empty. The terminal rule from the basics (nothing accepted once leaving is decided; form inert) is unchanged and is only ever entered clean.

**Markers are eligibility, not provenance.** "Already has a paragraph starting '…'" is a literal fact about the text. It does not say who wrote it, that it is true, or how many there are. "What did you do about it?" is offered when the challenge lead-in is in the text; that is not proof a challenge was described.

**Conflicts.** The basics' rule, unchanged: a stale save is refused, the held revision is not swapped, and "keep my changes" replaces only the fields I changed. Added: when "What you did" is one of them, the panel says keeping mine will replace the saved text shown above, the whole of it. Notes survive either choice, and the panel says so.

## 5. The screen no longer plans a save

- The screen calls one thing: "start a save, then do this". The rules decide.
- If a save starts, the state records what was sent. `requestOf(state)` reads the request from that. The screen sends exactly that, once per save.
- If the rules refuse, no save is recorded, so there is nothing to send.
- The test driver does the same, so the state tests exercise the same path the screen uses.
- A boundary test pins that the screen contains no planner, one `requestOf`, one call each to save and create, and that a request is built from the recorded copy with no notes in it.

This changed the save path of accepted code. All 24 accepted browser fixtures and all accepted state tests pass on it unchanged.

## 6. Verification actually run

| Command | Result |
| --- | --- |
| `npx vitest run` | 93 files, 2,090 passed, 4 skipped (2,005 at the base; 85 new) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 487 warnings, same as the base |
| `npm run test:case-library-sql` | pass, script unmodified (a no-change check; there is no new SQL) |
| `E2E_EVIDENCE=1 npm run e2e:import-fixture` | 27 of 27: the 24 accepted, plus the depth journey on desktop, phone and keyboard. Includes the production build. |

Order of runs, for honesty: the full browser run was made on the final application code. After it, one test file was changed to fix a lint error (`let` to `const` in the random-walk test), and the unit suite, typecheck and lint were run again. No application source changed after the browser run. A plain `npm run build` without the harness was not run.

The fixture server log contains "Your project's URL and Key are required to create a Supabase client" errors. I checked: running the existing profile fixture alone produces them, and running the depth fixture alone produces none. They are not from this change.

## 7. Tests added

**`guided-depth.test.ts` (35), pure.** A seeded generator in the file, no dependency.

- `add`: 12,000 generated cases across the three lead-ins: exact prefix, exact suffix, exact result, exact length by characters and by UTF-16 units; empty text gets no blank line; spaces at either end of a note kept; no normalising (combining and precomposed forms stay different; CR, lone surrogates, NUL pass through).
- `present`: start of text and after a blank line; not mid-line, after one line break, without its space, or in other case; not after U+2028, U+2029, U+0085 or a line holding a space, tab or no-break space; repeated and reordered paragraphs are simply "present"; total and non-mutating over 4,000 generated strings; true after any Add.
- **Carriage returns:** a paragraph after CRLF CRLF is not seen and an in-memory Add would append another; the existing content rule refuses that text; the existing action's CRLF-to-LF tidy-up makes the paragraph seen. Stated as those three facts and nothing more.
- Other control characters, NUL and a lone surrogate: what Add does (nothing to them) and what the existing application rule says about saving the result. What the database then does with NUL or a lone surrogate is not tested here.
- `room` and `canAdd`: the boundary rows; a note of exactly the room fills the text to 5,000 and passes the content rule, one more is "no room"; the fixed order of reasons; over 6,000 generated cases, room decides exactly when nothing earlier does and "ok" always fits; a second Add for the same question is never "ok".

**`guided-state.test.ts` (+47), against the real service over the in-memory library.**

- Add: exact text, only its note emptied, no request; five refusals leave the identical state; other fields, kinds of work, consent and the approved copy unchanged after add and save; three consecutive adds and saves, each lead-in once and never offered twice; lost answer then no second write; a full text visited and unsent.
- The note bound; room shrinking after typing.
- **D1**, both targets, for a note of real text, only spaces, and a line break: nothing to save → no leave, nothing locked, nothing sent, the note still editable, and it leaves once notes are dealt with. Something to save and a note already there → named refusal, `requestOf` is null, zero requests. A note typed while a save-then-go runs, saved and already-saved replies → held, not locked; clear and leave; or add, save and leave. Failed and unknown replies stay. The terminal state is only entered with no notes.
- Ordinary save with a note: not in any request or stored row; unchanged; still named. Next with a note already there moves on; with one typed, changed or cleared during the save it stays. An Add during a save holds Next.
- What does not change a note; a new visit; depth unreachable before the case study exists.
- Conflicts: my words still a note beside the same paragraph in the latest text (both choices: no duplicate, note intact, Add refused); my words already added (keep mine replaces that field only; the held revision is not swapped; nothing written by choosing); taking the saved version.
- **A random walk** (12 walks of up to 60 steps: typing, clearing, adding, editing, moving, saving with replies delivered later, edits from elsewhere, conflict choices). After every step: a note changed only by typing or its own Add; `leave` never set with anything unsaved or any note; a held state is never terminal. At the end: no note text reached a request or the stored row unless it had been added; each lead-in at most once. The contractor's own explicit clear is one of the walk's actions and is an intended change.

**`boundary.test.ts` (+2, 2 strengthened).** The four points; no planner in the screen; no pattern, split, replace, slice or normalise in the depth file; a note written in exactly the three ways.

**`library-screens.test.ts` (+1).** The way in is offered for a saved job and not for a new one.

**`guided-depth.fixture.ts` (browser, 3 projects).** Spaces only (not addable, named, asks before reload, "Save, then go" disabled, nothing locked or sent); **delayed answer** with a note typed during "Save and next", during "Save, then go" to the list, and to the full form (held each time, note intact, nothing sent again; "Go without saving" still works); notes gone on a new visit; a note beside a paragraph that arrived from elsewhere (no Add offered, both visible); the exact preview, Add with no request, and the exact stored text; the replacement warning and whole-field keep-mine; a failed save after an Add; **delayed answer** while typing in the one whole-text box; no question offered again once its paragraph is there; a 5,000-character text (no room, unsent, still saves); only create and save were ever called. Eight checkpoints per project: no undersized control, sideways scroll or serious accessibility finding. Keyboard: 77 controls reached, all with visible focus.

**The tests bite.** Each change restored afterwards and the files compared byte for byte.

| Change | Unit tests failing |
| --- | --- |
| D1 as I first designed it (no refusal at the start; reply leaves on a clean draft) | 18 |
| `mayLeave` ignores notes | 2 |
| Next not held by a note typed during the save | 3 |
| Add leaves its note in place | 5 |
| A confirmed save clears notes | 18 |
| A note is sent with the draft | 3 |
| Add trims the note | 6 |
| Add normalises line endings in the text | 7 |
| An over-long note is cut to fit | 3 |
| The already-present check dropped | 7 |

## 8. Limits and residuals

**Behaviour to know about**

- **A depth answer is not separately editable after Add**, even in the same visit. It is text in the one box.
- **A stranded note has to be copied by hand.** If a paragraph with the same lead-in arrives from elsewhere, or the room runs out, the note stays in its box with a plain message and no Add. The alternatives were a second lead-in or a merge.
- **"Go without saving" discards notes**, by the contractor's choice. Nothing else does.
- **Moving on by hand with a note there is allowed.** Next, Skip, Back and a jump keep it and the status line names it.
- **Next and notes already there:** see the flagged reading in section 2.
- **The refusal message for a save-then-go with a note** is not reachable from the screen's own button, which is disabled in that case and says why. The rule is in the rules and unit-tested; the button is a second layer.
- **One keystroke after a clean leave is decided** is not applied, as in the basics.

**What this does not show**

- **No hosted or authenticated run.** Migration 110 is not approved for any hosted project and none was contacted.
- **Sign-in and the switch are not exercised in the browser.** The harness does not use the real pages; the accepted route tests cover them and are unchanged.
- **No real phone keyboard.** The phone project is a touch viewport.
- **No DOM-level unit test of the screen.** The screen is exercised in the browser fixture and pinned by source-level boundary tests; the rules it calls are unit-tested through the same `requestOf` path.
- **CRLF.** The eligibility difference is shown in memory only. It is not a demonstrated stored duplicate and not an incident.
- **NUL and lone surrogates.** The existing application rule accepts them in this field; what the database does with them was not tested. Unchanged and not relied on.
- **No claim about writing quality.** These are the contractor's own words with three fixed lead-ins. This is not AI wording and does not meet or test the premium wording intent.
- **Earlier screenshots** under `docs/evidence/stage2-tranche-2g4/guided/` and `client/` were left as they were. The guided summary and finish screens now also show the way in to these questions.
- **The delayed-answer steps** rely on typing within a 5-second delay. A much slower machine would make them fail, not pass wrongly.

**Unchanged and still open:** a second copy after an unconfirmed first create; the older editor's whole-list save and positional identity; the single-database assumption of the one-revision read; the Back-button guard tried in Chrome only.

## 9. Recommendations that are not decisions

Nothing here is an owner approval, and none was asked for:

- the three lead-ins as words clients would read;
- whether a lesson belongs under "What we delivered";
- whether depth ships with the basics or later (same switch either way);
- an answers record, any AI wording, budget or spend;
- migration 110 on any hosted project, branch configuration, rollout.

## 10. Not done

No push, PR, merge or deploy. No schema, SQL, grant, storage, AI, provider, secret or dependency. No parser or splitting of saved text. No pictures, older-editor change, banking, legal, website or brochure work. No hosted read or write. Frozen worktrees are unchanged. `.next`, `test-results` and the copied harness are absent from the worktree.
