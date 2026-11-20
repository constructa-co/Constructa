## CON-023 — Parallel owned estimate read on existing-estimate save — 19 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/projects/costs/simple-actions.ts` | `saveSimplePriceLineAction` (~98–130) | When `parsed.data.estimateId` is set, `Promise.all` overlaps project `organization_id`/`status` read with owned-estimate `id`/`is_client_boq` verification | Shorter serial critical path on save into an existing estimate; no-estimate create/reuse path unchanged |

Checks: not run locally (CI sole verifier). Wall-clock improvement unmeasured; one critical-path read pair overlapped. Codex owns CI/PR/review.