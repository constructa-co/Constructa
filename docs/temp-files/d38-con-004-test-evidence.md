# D38 CON-004 test and build evidence (2026-11-15)

Base verified before work: `33d8fd3f986571b669567a99039bf0166d3d9085` (main).
Branch: `cursor/constructa-d38-con-004-b37b` (draft PR #171, no duplicate).

## BLOCK #171 — focused vitest

```bash
npm_config_engine_strict=false npx vitest run \
  src/lib/uk-bank-holidays.test.ts \
  src/lib/uk-bank-holidays-feed.test.ts \
  src/lib/programme-plan.test.ts \
  src/lib/planning-conversation.test.ts \
  src/lib/proposal-document.test.ts \
  src/lib/pdf/proposal-programme-bars.test.ts \
  src/lib/planner-display-plan.test.ts
```

**Result:** 7 files, **106 passed**.

```bash
npm_config_engine_strict=false npx vitest run \
  src/lib/server/job-assistant-readiness.test.ts \
  src/lib/server/job-assistant-request.test.ts \
  src/components/programme-calendar-span-a060.test.tsx
```

**Result:** 3 files, **120 passed**.

## Typecheck

```bash
npm_config_engine_strict=false npm run typecheck
```

Exit 0.

## Guarded synthetic cloud build (preview)

See `docs/temp-files/d38-con-004-block171-build.log`. Closing guard lines:

```
Supabase target check: context=preview (from VERCEL_ENV) expected=umqtzfsnyoofmgfbnrgv url=umqtzfsnyoofmgfbnrgv anon-key=not stated by this key format service-key=umqtzfsnyoofmgfbnrgv -> PASS
Compiled Supabase target: context=preview (from VERCEL_ENV) expected=umqtzfsnyoofmgfbnrgv projects in build=umqtzfsnyoofmgfbnrgv -> PASS
```

## CON-004 acceptance (unchanged)

- Start: Monday **2027-02-01** (England and Wales)
- **65** working days → finish **2027-05-05** (Wednesday)

## Year-end regression (restored)

- `addWorkingDays("2026-12-24", 5)` → **2027-01-04** (skips Christmas, substitute Boxing Day, New Year’s Day)

## Note

`src/lib/programme-working-pattern-integration.test.tsx` still hangs in this VM when run with vitest; not used as a gate here.