## D36 template estimate bootstrap — 16 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/library/templates-actions.ts` | 4, 89–95 | Import `companyMarkupMethod` and set `markup_method` when `applyTemplateAction` creates a project's first estimate | Close PR #176 gap: template-created estimates must snap the company method like `createEstimateAction` and simple lazy-create |
| `src/app/dashboard/library/templates-actions.apply-template.test.ts` | 1–130 | Regression tests for template apply when creating vs reusing an estimate | Prove company `compound` profile flows into new estimate rows and existing estimates are untouched |