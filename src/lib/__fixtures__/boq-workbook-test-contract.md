# BOQ workbook intake — test contract (D120 fixtures, pause before module tests)

Status: **draft regression prepared, execution gated** on branch `codex/d120-boq-workbook-tests-20261127`.
`src/lib/boq-workbook.ts` transfers from Claude/R1 when ready; `boq-workbook.d.ts` is an API
snapshot only (remove when implementation lands). Worker must not edit production module.

**Acceptance boundary:** `boq-workbook-fixtures.test.ts` is factory self-check only. It is **not**
import regression acceptance for all-tab intake.

## Fixture factory

- **Module:** `src/lib/__fixtures__/boq-workbook.ts`
- **Smoke:** `src/lib/__fixtures__/boq-workbook-fixtures.test.ts` (encode/grid integrity only)

## Capture limits (current `main` behaviour — fixtures encode these boundaries)

| Layer | Limit | Where today |
| --- | ---: | --- |
| Browser SheetJS row cap | 200 | `boq-import.tsx` (`slice(0, 200)`) |
| Server AI text rows | 150 | `parseBoQFromExcelDataAction` (`slice(0, 150)`) |
| CSV deterministic path | no 200 cap in parser | `parseEstimateBatchCsv` |

Fixtures deliberately include **>200** physical rows and marker rows at indices **150** and **200**
so all-tab intake tests can prove rows beyond each cap are still discovered or reconciled once the
new module exists.

## Scenario IDs (synthetic data only)

| ID | Covers |
| --- | --- |
| `multi-tab-over-200` | Three tabs; primary tab 215 data rows; markers at 150/200; secondary tabs smaller |
| `empty-middle-tab` | Non-empty → **empty** → non-empty sheet order |
| `merged-repeated-headers` | Repeated header bands + merged title row (XLSX `!merges`) |
| `reconciliation-mismatch` | **Line total:** qty × rate ≠ stated total (`total_mismatch` semantics today) |
| `csv-single-tab-baseline` | Same logical grid as CSV bytes (no XLSX) |

All descriptions/refs use the `SYNTH-BQ-*` prefix — no private client filenames or site data.

## Awaiting R1 / Claude — proposed production test surface (not implemented here)

Once the module contract is supplied, add **focused regression** tests (no OpenAI, no hosted DB):

### Proposed pure-parse module (path TBC from R1)

Likely responsibilities to cover with fixtures:

1. Enumerate **every** worksheet (not first sheet only).
2. Skip or flag **empty** tabs without aborting the workbook.
3. Collapse **repeated / merged header** bands into one logical header per tab.
4. Return **source row provenance** (sheet name + 1-based row, and stable source key) per imported line.
5. **Source row coverage reconciliation** (primary “reconciliation mismatch” for phase 2): compare
   imported lines to the source grid — dropped rows, duplicate imports, unaccounted source rows,
   imported vs source **counts** per sheet and workbook. Emit warnings when coverage does not match.
6. **Line total reconciliation** (keep separate): when qty/rate cells parse, flag `total_mismatch`
   when stated total ≠ qty × rate (same as `ClientBoQLine` / `EstimateBatchCsvLine` today).
   The existing `reconciliation-mismatch` fixture targets (6) only.

**Actual module (R1, local Claude):** `src/lib/boq-workbook.ts`  
**Exports:** `extractBoQWorkbook`, `workbookInputFromSheetJS`, `boqWorkbookImportBlockers`  
**Draft tests:** `src/lib/boq-workbook-intake.regression.test.ts` (`describe.skip` until `boq-workbook.ts` exists)

### Proposed test files (after contract)

| File | Scope |
| --- | --- |
| `src/lib/boq-workbook-intake.test.ts` | Import regression only: tab coverage, caps 150/200, empty tab, headers, **source row coverage**, line total_mismatch |

Do not add parallel test-only scaffolding modules; extend fixtures only when the contract names
the shapes needed for dropped/duplicate/unaccounted cases.

### Proposed assertions (shared shape — align types with R1)

```ts
// Illustrative only — types/names from Claude contract, not this repo yet.

// Source row coverage (phase 2 primary reconciliation)
expect(result.sourceReconciliation.importedCount).toBe(result.sourceReconciliation.accountedSourceRows);
expect(result.warnings).toContainEqual(expect.objectContaining({ code: "source_row_dropped" })); // when fixture supplies gap

// Line total (existing scenario `reconciliation-mismatch`)
expect(result.lines[0].total_mismatch).toMatchObject({ stated: 999, computed: 120 });

// Beyond-cap discovery
expect(result.lines.find((l) => l.source.row === 151)).toBeDefined();
expect(result.skippedSheets).toContain("SYNTH-Empty-Tab");
```

### Out of scope for D120 worker tests

- `parseBoQFromExcelDataAction` / GPT paths (paid AI)
- UI `BoQImport` dropzone behaviour
- Migrations, env, signup, deploy, PR-ready packaging

## Phase 2 gate

**Paused** until R1 posts the actual module path, function names, and result type (Claude API).
Then:

1. Implement `boq-workbook-intake.test.ts` against that contract (import regression acceptance).
2. Add fixture scenario(s) for dropped/duplicate/unaccounted source rows **only as required** by
   the contract — not ahead of it.
3. Keep `reconciliation-mismatch` for line `total_mismatch`; add source-coverage regression separately.