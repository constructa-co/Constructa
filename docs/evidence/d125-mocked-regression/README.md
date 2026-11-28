# D125 mocked regression screenshot pack (partial)

**Pack id:** `d125-mocked-regression`  
**Evidence branch (packaging base):** `codex/d125-mocked-regression-20261128` @ `4c887d899243a85bcc5a80161fbcfb061a070188` (`origin/main` after PR #285 merge).

## What this is

Offline **SYNTH_COMPONENT_VISUAL** captures at **375** and **1440** viewports: actual React components + compiled Tailwind/globals + `layout.tsx` root body classes (`bg-black text-white antialiased`). **TEST DATA only** — no HTTP, Supabase, auth bypass, or hosted writes.

## Per-surface source SHAs (immutable branch heads — not integrated main)

| Surface | Component | Source SHA | Remote branch (readonly) |
| --- | --- | --- | --- |
| Home | `HomeClient` | `fa9e4919f18214778c5ab4ed088052ab5dd40e6b` | `codex/d124-home-canonical-sum-20261128` |
| Live Projects | `LiveProjectsClient` | `779549eb1183c9620ccb5cb8cfd00f9f75769c5d` | `claude/d124-n2-5-live-query-errors-20261128` |
| Admin | `AdminClient` (overview only) | `9c0f28fc2493e9d032ea779815bc4602a46007f1` | `claude/d124-n5-1-admin-unverified-revenue-20261128` |

PR **286** / **284** remain pending on main at pack time; Rob authorised **branch-source** renders, not merged integration.

## Mock cases included (10 PNGs)

| PNG id | Viewports | Mock intent |
| --- | --- | --- |
| `home_success` | 375, 1440 | Healthy dashboard; no `dataWarnings` |
| `home_read_errors` | 375, 1440 | `dataWarnings` for failed secondary reads |
| `live_success` | 375, 1440 | All secondary sources loaded (`NONE_UNAVAILABLE`) |
| `live_unavailable` | 375, 1440 | Costs/invoices unavailable — not shown as £0 |
| `admin_overview` | 375, 1440 | Admin overview tab; revenue `no_verified_billing` truth |

## Explicitly NOT included

| Item | Status |
| --- | --- |
| `admin_revenue_{375,1440}.png` | **Not captured** — optional Revenue tab run halted; **not returned** |
| Whole-app brand PASS | **No** |
| Integrated main / auth routing / persistence | **No** |
| Live signed-in route certification | **No** |

## Full-copy breach (halted — not waived)

Packaging uses **existing** PNGs only. A prior D125 build step created **3 detached git worktrees** in addition to the primary checkout → **4 full source trees** (limit max 3 = **breach**). Worktrees preserved, not deleted. **No further builds/copies/captures** after halt.

See `manifest.json` → `copyBreach` and `gitleaks-receipt.json`.

## Artifacts

- `png/` — 10 screenshots  
- `provenance/` — per-PNG metadata  
- `fixture-bundles/*/source-manifest.json` — compiler fingerprints (JS bundles not committed)  
- `file-fingerprints.json` — sha256 list for committed pack files  
- `contactsheet-mocked-regression-{375,1440}.png`  
- `d125-mocked-regression-pack.zip` — portable bundle of the above  

Harness scripts under `docs/temp-files/d125-*` remain **untracked** and are **not** part of this commit.