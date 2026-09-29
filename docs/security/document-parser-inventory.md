# Document Parser Inventory

Last reviewed: 29 September 2026

This inventory records every retained PDF, spreadsheet, document and drawing
parser in Constructa. The default `cohort` launch profile denies all of these
tools; they remain available only in the internal `full` profile while their
product workflows are deferred.

| Capability | Entry points | Parser and runtime | Cohort disposition |
| --- | --- | --- | --- |
| Client BoQ PDF import | `projects/costs/boq-import.tsx`, `boq-import-action.ts` | `pdfjs-dist@6.3.289` in the browser; rendered pages are sent to the AI action | UI hidden and action denied by `client-boq-import` |
| Client BoQ spreadsheet import/export | `projects/costs/boq-import.tsx`, `boq-excel-export.ts` | SheetJS `xlsx@0.20.3` in the browser, installed from the vendor's supported distribution | UI hidden and import/export denied by `client-boq-import` |
| Drawing takeoff and measurement | `projects/drawings/drawings-client.tsx`, `drawing-viewer.tsx`, `actions.ts`, `measure-actions.ts` | `pdfjs-dist@6.3.289` in the browser; rendered pages are sent to server actions | Route denied and actions denied by `drawing-takeoff` |
| Contract PDF extraction | `projects/contracts/actions.ts` | `unpdf@1.4.0` on the server | Route and every action denied by `contract-shield` |
| Contract Word extraction | `projects/contracts/actions.ts` | `mammoth@1.12.0` on the server | Route and every action denied by `contract-shield` |

## Security controls

- PDF.js is loaded only when a deferred tool opens. Its worker is emitted by
  the application build and served from Constructa's own origin; no third-party
  CDN code is executed in the authenticated application.
- The official SheetJS 0.20.3 distribution replaces the stale npm-registry
  0.18.5 package. The exact vendor tarball and integrity hash are locked in
  `package-lock.json`.
- Cohort controls are enforced in the route proxy and again in the relevant
  server actions. Hiding a button is not the security boundary.
- `unpdf` and `mammoth` remain server-only external packages. Uploaded contract
  parsing must stay disabled for the cohort until the full-profile workflow has
  a dedicated hostile-file and resource-limit review.
- Safe and malformed PDF/XLSX dependency smoke tests live in
  `src/lib/document-parser-dependencies.test.ts`.

## Audit result

`npm audit --audit-level=high` reports zero vulnerabilities after upgrading
PDF.js and SheetJS. No residual critical/high parser advisory is accepted for
the retained dependency tree. The parser workflows themselves remain deferred
from Phase 1 pending full-profile functional and abuse testing.
