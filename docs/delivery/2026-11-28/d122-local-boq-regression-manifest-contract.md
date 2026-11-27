# D122 — Local BOQ workbook regression manifest (contract)

**Branch lane:** `codex/d122-local-boq-regression-20261128`  
**Parser pin:** same bytes as combined D120 test branch `73eb2eb` (parser commit `f070995e`).  
**Authority:** R1 runs this pack **locally** on Rob’s Mac against private Rev04 workbooks. Cloud agents author **generic code + SYNTH controls only** — never claim PASS on real tender files from cloud.

## Purpose

Execute the all-tab BoQ extractor on each workbook and compare **source/ledger coverage**, tab inventory, reconciliation balance, and (when supplied) **independent** line expectations. Report mismatch **codes** only in CI logs; monetary and tender text stay in R1’s private manifest/results.

## Opt-in execution

| Context | Behaviour |
| --- | --- |
| **CI / cloud** | Runs `boq-local-regression.synth.test.ts` only (SYNTH fixtures). |
| **Rob local** | Set `BOQ_LOCAL_MANIFEST_PATH` to an absolute path of a **private** JSON manifest (not committed). |
| **Unset env** | `boq-local-regression.local.test.ts` is **skipped** — status `NOT_RUN`, never PASS. |

No network, no upload of workbooks, no hosted writes.

## Manifest (`schema_version`: 1)

```json
{
  "schema_version": 1,
  "workbooks": [
    {
      "id": "generic-workbook-id",
      "source": { "kind": "file", "path": "/absolute/private/path/on/mac/SYNTH-or-rev04.xlsx" },
      "sha256": "64-char-hex-lowercase",
      "tab_count": 6,
      "include_sheets": ["Bill 2", "Bill 3"],
      "sheets": [
        {
          "name": "Bill 2",
          "source_rows": 120,
          "used_range": "A1:H120",
          "nonempty_rows": 95,
          "row_coverage_balanced": true,
          "selected": true,
          "expected_item_rows": 42,
          "hidden": false
        }
      ],
      "expectations": {
        "reconciliation_balanced": true,
        "total_item_rows": 42,
        "blocker_reason_categories": [],
        "lines": [
          {
            "client_ref": "A1",
            "source_sheet": "Bill 2",
            "source_row": 10,
            "quantity": 2,
            "unit": "nr",
            "line_total": 300
          }
        ]
      }
    }
  ]
}
```

### `source`

| `kind` | Use |
| --- | --- |
| `fixture` | In-repo SYNTH only: `{ "kind": "fixture", "scenario_id": "csv-single-tab-baseline" }`. Optional `sha256` — verified against encoded bytes when present. |
| `file` | **Private manifests only:** `{ "kind": "file", "path": "/absolute/..." }`. `sha256` **required**. Original **mtime** must be unchanged after read (no writes). |

### Independent expectations (R1)

- Tab counts, `source_rows`, `used_range`, and line `line_total` / `quantity` must come from **Rob’s independent XML inventory**, not from the parser under test.
- `blocker_reason_categories`: optional list of coarse categories (e.g. `import_blockers`, `unbalanced`) — not full blocker prose.

### SheetJS read (unchanged)

`BOQ_SHEETJS_READ_OPTIONS`: cached values only; formulas present but **not evaluated**; no VBA/styles.

## Runner API (`src/lib/boq-local-regression.ts`)

- `loadBoqLocalManifest(path)` — parse JSON.
- `runBoqLocalRegression(manifest)` → `BoqWorkbookCheckResult[]` (sanitized summaries + `codes_failed`).
- `assertBoqLocalRegression(results)` — throws on failure (local vitest).

### Check codes (public)

`sha256`, `mtime`, `tab_count`, `source_rows`, `used_range`, `balanced`, `ledger_unique`, `item_rows`, `line_count`, `line_ref`, `line_qty`, `line_unit`, `line_total`, `blockers`

## SYNTH example (committed)

`src/lib/__fixtures__/boq-local-manifest.synth.example.json` — fixture sources and **grid-derived** row counts only; no tender names or private paths.

## Cloud agent constraints

- Do not commit real filenames, client names, or £ amounts from Rev04.
- Do not auto-generate private expectations from `extractBoQWorkbook` output for R1 manifests.
- Defects found during SYNTH work → report case to R1; **no parser edits** on D122 without separate authorisation.