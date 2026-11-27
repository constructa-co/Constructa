# BOQ workbook intake — test contract (D120)

**Phase 2 active** on `codex/d120-boq-workbook-tests-20261127` after merge of implementation
`8dfecac7` from `codex/d120-all-tab-boq-import-20261127`.

## Fixtures

- `src/lib/__fixtures__/boq-workbook.ts` — SYNTH multi-tab scenarios
- `src/lib/__fixtures__/boq-workbook-fixtures.test.ts` — factory encode smoke only

## Regression acceptance

- `src/lib/boq-workbook-intake.regression.test.ts` — fixture-driven intake (this lane)
- `src/lib/boq-workbook.contract.test.ts` — implementation contract suite (Claude source)

### API

- `extractBoQWorkbook(input, { includeSheets? })`
- `workbookInputFromSheetJS` + `BOQ_SHEETJS_READ_OPTIONS`
- `boqWorkbookImportBlockers(extraction)` — `BOQ_IMPORT_MAX_LINES` (2000) / `BOQ_IMPORT_MAX_SECTIONS` (100)
- Line fields: `source_row_end`, `heading`, `value_notes`, `over_limit`, `continuationRows` in reconciliation totals

### Test semantics (do not weaken)

| Topic | Assert |
| --- | --- |
| Source ledger | One `sheet!row` disposition per source row; `reconciliation.balanced` |
| Duplicate provenance | Same `source_sheet` + `source_row` on two **lines** only |
| Identical text | Two different `source_row` values — two lines |
| NRM layout | `continuation` + `item` share `lineIndex`; line `source_row`/`source_row_end` span |
| Line total mismatch | `total_mismatch` + `mismatchRows`; not necessarily a blocker |
| Over-limit / errors | `over_limit`, `blockers`; uncached formula / `errorCells` |

## Gate

Report failing assertions as API defects before production edits. No PR from this lane until R1 workflow check.