# BOQ workbook intake — test contract (D120 fixtures, pause before module tests)

Status: **fixtures only** on branch `codex/d120-boq-workbook-tests-20261127`. Production
all-tab workbook intake is owned separately; do not assert against guessed module paths here.

## Fixture factory

- **Module:** `src/lib/__fixtures__/boq-workbook.ts`
- **Smoke:** `src/lib/__fixtures__/boq-workbook-fixtures.test.ts` (factory integrity only; no production imports)

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
| `reconciliation-mismatch` | Qty × rate ≠ stated total on numbered synthetic lines |
| `csv-single-tab-baseline` | Same logical grid as CSV bytes (no XLSX) |

All descriptions/refs use the `SYNTH-BQ-*` prefix — no private client filenames or site data.

## Awaiting R1 / Claude — proposed production test surface (not implemented here)

Once the module contract is supplied, add **focused regression** tests (no OpenAI, no hosted DB):

### Proposed pure-parse module (path TBC from R1)

Likely responsibilities to cover with fixtures:

1. Enumerate **every** worksheet (not first sheet only).
2. Skip or flag **empty** tabs without aborting the workbook.
3. Collapse **repeated / merged header** bands into one logical header per tab.
4. Return **source row index** (sheet name + 1-based row) per imported line for reconciliation.
5. Emit **workbook-level warnings** when source cell totals disagree with normalized `qty × rate`
   (same semantics as `total_mismatch` on `ClientBoQLine` / `EstimateBatchCsvLine`).

**Proposed import path (placeholder):** `src/lib/boq-workbook-intake.ts`  
**Proposed export name (placeholder):** `parseBoqWorkbookAllTabs(input: ArrayBuffer | BoqWorkbookSheet[]): BoqWorkbookIntakeResult`

### Proposed test files (after contract)

| File | Scope |
| --- | --- |
| `src/lib/boq-workbook-intake.test.ts` | All scenarios: tab count, row counts, markers 150/200, empty tab, headers, mismatches |
| `src/lib/__fixtures__/boq-workbook-integration.test.ts` | Optional: wire to server action only if R1 exposes a **non-AI** entry (e.g. `rows[][]` per sheet) |

### Proposed assertions (shared shape — align types with R1)

```ts
// Illustrative only — types/names from Claude contract, not this repo yet.
expect(result.warnings).toContainEqual(expect.objectContaining({ code: "total_mismatch" }));
expect(result.lines.find(l => l.source.row === 151)).toBeDefined(); // beyond 150 AI slice
expect(result.lines.find(l => l.description.includes("SYNTH-BQ-MARKER-200"))).toBeDefined();
expect(result.skippedSheets).toContain("SYNTH-Empty-Tab");
```

### Out of scope for D120 worker tests

- `parseBoQFromExcelDataAction` / GPT paths (paid AI)
- UI `BoQImport` dropzone behaviour
- Migrations, env, signup, deploy, PR-ready packaging

## Phase 2 gate

**Pause here** until R1 posts the actual module path, function names, and result type. Then implement
`boq-workbook-intake.test.ts` against that contract using `getBoqWorkbookScenario()` / XLSX buffers.