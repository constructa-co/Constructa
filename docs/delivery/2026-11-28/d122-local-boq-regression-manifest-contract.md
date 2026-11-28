# D122 — Local BOQ workbook regression manifest (contract)

**Branch lane:** `codex/d122-local-boq-regression-20261128`  
**Parser pin:** combined D120 test branch `73eb2eb` / `f070995e`.  
**Authority:** R1 runs **locally** on Rob’s Mac with private manifests. Cloud: SYNTH only.

## Manifest fields (`schema_version`: 1)

| Field | Required | Meaning |
| --- | --- | --- |
| `workbooks[].id` | yes | Stable label in reports (no tender names in repo examples). |
| `workbooks[].source` | yes | `{ kind: "fixture", scenario_id }` (SYNTH) or `{ kind: "file", path }` (private). |
| `workbooks[].sha256` | file: yes | Lowercase hex of full file bytes before parse. |
| `workbooks[].tab_count` | yes | Must equal adapter tab count. |
| `workbooks[].require_all_tabs_listed` | default true | When true, `sheets[]` must name **every** tab exactly once (`tab_coverage` if any omit/extra). |
| `workbooks[].sheets[].name` | yes | Tab name. |
| `workbooks[].sheets[].source_rows` | **required for `file`** | Used-range row count from parser reconciliation. |
| `workbooks[].sheets[].nonempty_rows` | **required for `file`** | **Source-input** rows with any non-empty cell (formulas, errors, text, `0`, `false` — not parser `blankRows`). |
| `workbooks[].sheets[].numeric_cell_count` | **required for `file`** | Count of finite numeric cached values on tab. |
| `workbooks[].sheets[].numeric_cells_sha256` | **required for `file`** | Canonical digest (below). Thin/name-only tabs → `expectation_missing`. |
| `workbooks[].expectations.expected_has_blockers` | optional | **Boolean only:** `true` if `boqWorkbookImportBlockers` non-empty; `false` if clean. |
| `workbooks[].expectations.selected_line_total_sum_cents` | optional | Sum of selected import line totals in pence (independent bill). Mismatch → `line_total_sum_cents` (no amounts logged). |

Removed: `blocker_reason_categories` (was not enforced per category).

## Numeric cell digest (all tabs, cached numerics only)

For each finite numeric cell in `workbookInputFromSheetJS` adapter `rows`:

1. Absolute **1-based** row = `(firstRow ?? 0) + gridRow + 1`
2. Absolute **1-based** col = `(firstCol ?? 0) + gridCol + 1`
3. Token: `{row}:{col}:{hex}` where `hex` is IEEE-754 **big-endian** `double` for `v` (`Buffer.writeDoubleBE`)
4. Sort tokens by row, then column
5. `numeric_cells_sha256 = sha256(tokens.join("\n"))` — **no** trailing newline

R1 may generate expected digests from raw XML typed `v` with Python `struct.pack(">d", v)`.

Implementation: `numericCellsDigestForSheet()` in `src/lib/boq-local-regression.ts`.

## File integrity

- `sha256` checked before parse.
- For `file` sources, `mtime` captured before read and re-checked **after** full extraction; mismatch → `mtime`.

## Check codes

`sha256`, `mtime`, `tab_count`, `tab_coverage`, `source_rows`, `nonempty_rows`, `used_range`, `balanced`, `ledger_unique`, `item_rows`, `line_count`, `line_ref`, `line_qty`, `line_unit`, `line_total`, `line_total_sum_cents`, `blockers`, `numeric_count`, `numeric_digest`, `expectation_missing`, `selected`, `hidden`

## Local run

```bash
export BOQ_LOCAL_MANIFEST_PATH=/absolute/path/private-manifest.json
npm run test -- src/lib/boq-local-regression.local.test.ts
```

Unset env → vitest `skip` (`NOT_RUN`), never PASS. Set env but missing file → **FAIL** (`loadBoqLocalManifest` throws).

## SYNTH example

`src/lib/__fixtures__/boq-local-manifest.synth.example.json`