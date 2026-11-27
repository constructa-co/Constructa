# BOQ workbook intake — test contract (D120)

**Paused** until R1 transfers `src/lib/boq-workbook.ts`. No placeholder `boq-workbook.d.ts`
and no skipped regression in final accepted source.

## Fixtures (shipped)

- `src/lib/__fixtures__/boq-workbook.ts` — SYNTH multi-tab scenarios (`39bdcab9` factory)
- `src/lib/__fixtures__/boq-workbook-fixtures.test.ts` — factory smoke only (not intake acceptance)

## Pending regression (not in `src/` until module lands)

- Draft (R1-reviewed semantics): `temp-files/backup/d120-boq-workbook-intake.regression.test.ts.off` (rename to `.ts` under `src/lib/` after transfer)
- **Enable as:** `src/lib/boq-workbook-intake.regression.test.ts` after transfer
- **Imports:** real `@/lib/boq-workbook` only

### API (R1 / Claude)

- `extractBoQWorkbook(input: { filename, sheets: BoQSheetInput[] })`
- `workbookInputFromSheetJS(filename, workbook)` — SheetJS `XLSX.read` buffer
- `boqWorkbookImportBlockers(extraction, maxLines = 2000)`

### Reconciliation semantics for tests

| Concept | Meaning |
| --- | --- |
| **Line total mismatch** | qty × rate ≠ stated total (`mismatchRows` / line fields) — keep `reconciliation-mismatch` fixture |
| **Source row coverage** | Every source row accounted; dropped/duplicate **account**; counts vs dispositions |
| **Duplicate provenance** | Same **sheet + source_row (1-based)** imported or accounted **twice** |
| **Not a duplicate** | Identical item text on **different** source rows — must remain two lines |

Regression must assert **provenance key collision**, **lineIndex ↔ line**, and **per-sheet count balance** —
not description or cell-value uniqueness.

### Scenarios to exercise when enabled

`multi-tab-over-200` (beyond 150/200), `empty-middle-tab`, `merged-repeated-headers`,
`reconciliation-mismatch`, grid + SheetJS paths.

## Gate

No further test commits until `boq-workbook.ts` is on branch. On enable: run intake regression;
report `API defect candidate` findings before production edits. No PR until R1 workflow check.