# ROB2245 — Cursor A038 case-study text enhance OFF

**When:** 2026-10-30 ~22:45 UAE  
**Worktree:** `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a038-photos`  
**Branch:** `cq/a038-photos`  
**Base pin:** `4c66969e92372d26d7136c1c5ce34f40512891c1`  
**HEAD (unchanged):** `4c66969e92372d26d7136c1c5ce34f40512891c1`  
**Prior return:** ROB2233 (NO_PRODUCT_DELTA; enhancement “OFF for evidence” only in prose — UI + action still wired)

---

## 1. Product delta (this session only)

**YES — minimal OFF wiring.** Explicit application flag `CASE_STUDY_TEXT_ENHANCE_ENABLED = false` (mirrors `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` pattern). Enforced:

| Layer | Behaviour when OFF |
|-------|-------------------|
| `enhanceCaseStudyAction` | After `requireAuth`, returns contractor text + `COHORT_AI_OFF` **before** `createAdminClient` / budget / provider |
| Legacy `case-studies-client.tsx` | Guard in `handleEnhance`; button disabled + “(not available yet)” label |
| Library `case-study-editor.tsx` | Same guard + disabled button |

**Not changed:** photo SQL/wire (`CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` still false), storage uploads, image AI, A055 transport. Pure `enhanceCaseStudy()` in `lib/cohort-ai` still exists for cohort unit tests / eval — dashboard path is gated.

**Why not “already OFF” via DB seed alone:** `enhanceCaseStudyAction` still called `enhanceCaseStudy` → admin RPC on every signed-in click; tests with `cohortEnabled: true` would reach provider. Rob22:18 closure requires **application-level** OFF, not only `ai_generation_features.enabled = false`.

---

## 2. Files (net vs `4c66969`)

| Path | SHA-256 (working tree) |
|------|-------------------------|
| `src/lib/cohort-ai/case-study-enhance-enabled.ts` | `3cc78892cc56ef5ced4f307dbc11274cd0c40da68fd656c204f83f35c7360bb4` |
| `src/app/dashboard/settings/case-studies/case-study-enhance-off.test.ts` | `179401588359a0a8a955e2a608ac3a5e4c764afd91b1a7b696cb40b84a4048b6` |
| `src/app/dashboard/settings/case-studies/actions.ts` | (modified) |
| `src/app/dashboard/settings/case-studies/actions.test.ts` | (modified) |
| `src/app/dashboard/settings/case-studies/case-studies-client.tsx` | (modified) |
| `src/app/dashboard/settings/case-studies/library/case-study-editor.tsx` | (modified) |
| `docs/cursor-change-log.md` | (append ROB2245 + prior ROB2233 row vs base) |

**Patch (OFF delta vs `4c66969`, excludes ROB2233 return markdown):**  
`PRIVATE/ROB2245-CURSOR-A038-OFF-RETURN.patch` (174 lines)

**Temp vitest config (bounded, not for merge):** `.temp/vitest-enhance-off.mts`

**Also copy to:** `/Users/robertsmith/dev/constructa-private-20261027/ROB2245-CURSOR-A038-OFF-RETURN.{md,patch}` (operator copy — agent sandbox blocked private path write)

---

## 3. Focused verification

### TypeScript

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a038-photos
/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/.bin/tsc --noEmit --incremental false \
  -p /Users/robertsmith/dev/constructa-fresh-20261025/tsconfig.json
```

**This session:** exit 0 (no TS errors; `--incremental false` avoids parent `tsconfig.tsbuildinfo` EPERM).

### Vitest (focused)

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a038-photos
/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/.bin/vitest run --config .temp/vitest-enhance-off.mts
```

**This session:** **RESOURCE BLOCKER** — `EPERM` writing `…/node_modules/.vite-temp/…` (same class as ROB2233). Tests are written for RED/GREEN grade on Kimi/parent host; not a failing assertion.

**Expected GREEN (when runner can write vite temp):**

- `actions.test.ts` — “with the application flag off”: `mocks.order === ["auth"]`, no `createAdminClient`, text preserved, `COHORT_AI_OFF`
- `case-study-enhance-off.test.ts` — flag false; UI/action source order guards before `await enhance(` / `createAdminClient(`

---

## 4. Photo contract (unchanged — still incomplete for Complete)

| Item | State |
|------|--------|
| `CASE_LIBRARY_DRAFT_PHOTOS_ON_WIRE` | `false` |
| `20261028120000_case_library_photos.sql` | NOT_APPLIED |
| Hosted MAX3 / upload / proposal photo proof | Incomplete |

Enhancement OFF **does not** prove photos.

---

## 5. Scope respected

Source + focused tests + changelog only. No commit/push/SQL/env/deploy/PR. Uncommitted for Kimi grade. **Not self-Complete.**
