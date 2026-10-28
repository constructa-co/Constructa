# ROB2210 — A040 Phase 1A manual / client address (non-provider) return

**Date:** 2026-10-28 (UTC)  
**Agent branch:** `codex/a040-phase1a-manual-client-20261028`  
**Pin (HEAD = base):** `6a192967570df57df5efd2636d003d5723676687` (`feat: CHECKPOINT2050 A001 settings + workflow brand controls`)  
**Prior A038 tip (out of scope here):** `441ddcf8358819e3a2d6710155a47846f2c83291` on `codex/a038-case-photos-20261028`

## Verdict: **NO_PRODUCT_DELTA**

Independent read of source + tests on pin `6a19296`: the three **non-provider** Phase 1A requirements are already implemented and covered. No bounded code repair was justified; applying the photos/SQL or a paid postcode migration would **not** by itself complete “UK lookup live” (see provider blocker).

---

## ORIGINAL-SCOPE boundary grade

| Requirement | Grade | Evidence |
|-------------|-------|----------|
| **Manual / unusual-site fallback** | **Adequate (non-provider)** | Site-only `data-unusual-site-fallback` on new job (`JobAddressField` + `showUnusualSiteFallback`) and settings (`client-page.tsx`); literal free-text textarea retained until explicit **Use this address** (`ManualAddressEntry`) or explicit postcode **candidate pick** (`PostcodeAddressPicker`). Unusual unicode site preserved in create tests (`new-project-form-manual-address.test.tsx`). |
| **Separate client address selection** | **Adequate (non-provider)** | Distinct site vs client fields (`new-project-form.tsx` two `JobAddressField`s; settings separate `client_address` / `site_address` textareas + pickers). Postcode pick on client does not overwrite site free text (`new-project-form-postcode.test.tsx`). Proposal/review does not label client address as site (`review-send-client.test.ts`). |
| **Postcode-first + explicit candidate / Manual Use, default unconnected** | **Adequate (non-provider)** | `PostcodeAddressPicker`: Find disabled without input; **no `lookup` → no network**, shows `POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE` (`postcode-address.ts`, picker tests). `ManualAddressEntry`: preview + **Use this address** only (`manual-address-entry.test.tsx`). Create refuses while structured draft pending; plaintext 500-char guard; owner/lock/pending refusal on settings apply (`manual-address-entry.test.tsx`, `client-page.tsx` `applyAddressField`). |

**Out of scope (explicit provider decision):** wiring a live `PostcodeLookupFn` from `new/page.tsx` or settings into production, API keys, provider geography/pricing, and any hosted lookup.

---

## Provider-only blocker (single gate)

Production entry points **do not pass** `postcodeLookup`:

- `src/app/dashboard/projects/new/page.tsx` renders `<NewProjectForm … />` with **no** `postcodeLookup` prop → injected/test-only lookup path; UI honestly shows “not connected yet”.
- `src/app/dashboard/projects/settings/client-page.tsx` uses `<PostcodeAddressPicker … />` with **no** `lookup` prop → same.

**Enabling UK lookup later** requires an **explicit product/ops decision** plus a bounded follow-up: inject `PostcodeLookupFn` at those seams only (tests already use `postcodeLookup` / `vi.fn()` mocks). **Not** implied by any pending SQL or other branch work.

---

## Plain recommendation for Rob (manual now vs UK lookup later)

**Ship manual now:** contractors can type unusual sites, use structured parts with explicit **Use**, and keep client billing separate; address search UI is visible but honestly offline until you choose a provider.

**Defer UK lookup** until you pick provider, cost, privacy, and activation; then wire `postcodeLookup` on new job + settings only—no change to manual/unusual-site or separate-client rules.

---

## Existing proof (executed this run)

Focused address / manual suite (8 files, **66/66 pass**):

```text
src/components/manual-address-entry.test.tsx
src/lib/manual-address.test.ts
src/lib/postcode-address.test.ts
src/components/postcode-address-picker.test.tsx
src/app/dashboard/projects/new/new-project-form-manual-address.test.tsx
src/app/dashboard/projects/new/new-project-form-postcode.test.tsx
src/app/dashboard/projects/settings/manual-address-entry.test.tsx
src/app/dashboard/projects/new/unsaved-entry.test.tsx
```

Core manual / site–client isolation subset: **24/24 pass** (settings + new manual + component tests).

**Not re-run:** full repo vitest (775+), full 647 bundle, eslint sweep, `npm run build`, gitleaks (not installed in agent VM).

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **Pass** on pin `6a19296` |
| `npm run build` | **Not run** (no `.env.local` / Supabase keys — **not counted as pass**) |
| gitleaks | **Not run** (tool absent — **not counted as pass**) |

---

## Key source seams (unchanged)

| Seam | Path |
|------|------|
| Combined job address UI | `src/components/job-address-field.tsx` (textarea **not** tied to `disabled`; picker + manual are) |
| Postcode UI (optional lookup) | `src/components/postcode-address-picker.tsx`, `src/lib/postcode-address.ts` |
| Manual structured Use | `src/components/manual-address-entry.tsx`, `src/lib/manual-address.ts` |
| New job | `src/app/dashboard/projects/new/new-project-form.tsx`, `new/page.tsx` |
| Settings | `src/app/dashboard/projects/settings/client-page.tsx` |
| Persist | `src/app/dashboard/projects/settings/actions.ts`, `src/lib/blank-project.ts` |

---

## Changed paths this agent turn

**None (code/test).** Branch `codex/a040-phase1a-manual-client-20261028` points at pin `6a19296` with no product commits. This return file only.

---

## Note on nested `JobAddressField` / plain textarea

`JobAddressField` already routes `disabled` to postcode + manual only; the plain textarea stays editable while `creating` / structured-disabled (`job-address-field.tsx` lines 56–74 vs 89–91). Form-level tests exercise nested mount + `onChange` via `new-project-siteAddress` / `new-project-clientAddress` (`new-project-form-manual-address.test.tsx`, `unsaved-entry.test.tsx`). No uncovered **product** gap found; a standalone `job-address-field.test.tsx` would be test-only churn, not required for Phase 1A non-provider closure.
