# D29 walkthrough order for review

Use merged **#159** (`docs/delivery/2026-11-15/d29-rob-walkthrough-runbook.md`) for detailed steps, expected results and file references. This checklist mirrors **§1 Order and dependencies** only. Record the candidate SHA, deployed SHA and target before any hosted operation.

## Standing operator gates (from #159 §0.3–0.5 and `AGENTS.md`)

- **Preview HOLD** remains in force until the Constructa inbox lifts it. Steps marked **[HELD: Preview]** stop at NOT_RUN until then.
- **Real signup OFF** until the inbox lifts the signup hold. Steps marked **[HELD: signup]** stop at NOT_RUN until Rob approves the disposable target, synthetic account, hosted writes and legal wording.
- **[ROB]** — Rob decides or performs personally. **[OPERATOR-ONLY]** — credentials, dashboards, deployment, live SQL or third-party effects. Do not run **[HELD]** steps on the strength of this checklist alone.
- Read the current Constructa inbox before each gated operation. Defer any hosted step without explicit approval. Do not rerun evidence that already exists for the same SHA.

Private receipts: `d29/<register-id>-<UTC-date>.md` in the private execution record (no secrets in receipts). Coordinator updates `walkthrough-action-register.json`, `docs/delivery/<date>/changelog.md` and `handoff.md` in the same block as the work.

## Sitting order

**Active time** = Rob or operator hands-on minutes. **Typical waits** = builds, redeploys, vendor dashboards, email, inbox or legal approval (not counted in active totals).

| Order | ID | Summary | Tags | Receipt | Active | Typical waits |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **A086** | Pin candidate; approve disposable Preview target and Vercel protection; unauthorised visit challenged; permitted visit passes Supabase target guard and review read-only rules (#159 §2). | [ROB], [OPERATOR-ONLY], **[HELD: Preview]** | `d29/a086-…` | 25–40 min | Preview deployment build; protection settings |
| 2 | **A092** | One designated local session: Rob operates Cancel then Leave on project settings; record clean/dirty/reload/save paths (#159 §3). | [ROB], [OPERATOR-ONLY] setup | `d29/a092-…` | 15–25 min | Local `npm run dev`, automated prerequisites |
| 3 | **A089** | Record production-timing / Git-check fixture evidence from exact release CI or approved synthetic observation; do not block later steps on live timing (#159 §4). | [ROB] review, [OPERATOR-ONLY] CI | `d29/a089-…` | 10–20 min | CI job completion |
| 4 | **A105**, **A106** | Establish exposure facts (no credential use); revoke and replace Perplexity agent-proxy and Supabase PAT; verify issuer and dependents (#159 §5). | [ROB] revoke order, [OPERATOR-ONLY] | `d29/a105-…`, `d29/a106-…` | 35–55 min | Vendor issuer confirmation; consumer secret updates |
| 5 | **A074** | Rob approves target and migration; gate-off baseline; apply column; activate env; synthetic cover save/reload/web/PDF; rollback check (#159 §6). | [ROB], [OPERATOR-ONLY], **[HELD]** SQL/deploy | `d29/a074-…` | 30–45 min | Inbox SQL approval; redeploy |
| 6 | **A038** | Rob approves migrations and storage; legacy three-photo cap; library path with gate on; AI enhance NOT_RUN (#159 §7). | [ROB], [OPERATOR-ONLY], **[HELD]** SQL/deploy | `d29/a038-…` | 30–45 min | Migration/bucket approval; redeploy |
| 7 | **A023** | Rob approves signup hold lift, target, synthetic identity, enforcement and legal wording; checkbox, stored consent, first-sign-in path; separate Apply destination decision only after authority (#159 §8). | [ROB], [OPERATOR-ONLY], **[HELD: signup]** | `d29/a023-…` | 35–50 min | Legal/inbox approval; disposable signup |
| 8 | **A097**, **A096** | Rob decides analytics activation; rebuild with build-time flag; Vercel Web Analytics on; positive/negative beacon checks; audit statement (#159 §9). | [ROB], [OPERATOR-ONLY], **[HELD]** deploy | `d29/a097-…`, `d29/a096-…` | 25–40 min | Rebuild; analytics dashboard lag |
| 9 | **Kit** | Rob approves production flag and form ownership; Kit settings read; one submission with Rob's address; unsubscribe (#159 §10). | [ROB], [OPERATOR-ONLY], **[HELD]** deploy | `d29/kit-…` | 25–40 min | Redeploy; confirmation email |
| 10 | **A102** | Rob approves wording; manual LinkedIn/Facebook posts; live link check (#159 §11). | [ROB], **[HELD]** publication | `d29/a102-…` | 20–35 min | Live site spot-check on post day |
| 11 | **A103** | Rob fact/tone pass on draft guide; code change, build guards and explicit merge yes are **out of band** for this sitting (#159 §12). Record go/no-go and pilot gate only here. | [ROB], **[HELD]** merge/deploy | `d29/a103-…` | 15–25 min | Separate PR/build/merge if approved |
| 12 | **A001** | Rob walks **remaining** charcoal/sage palette gaps not covered by offline fixtures: authenticated, dynamic and full-profile surfaces (#159 limits; register Partial). See checklist below. | [ROB], [OPERATOR-ONLY] session | `d29/a001-…` | 35–75 min | Preview or local session setup; optional screenshots |

**Active total (if every step runs):** about 300–465 min. A single sitting will usually defer **[HELD]** rows; partial runs are expected.

**A079** recovery archive/scratch drill is a separate checklist (PR #164), not part of this order.

---

## A001 (D33) — remaining visual checks (order 12)

Static dashboard coverage already passes Vitest (`a001-palette-audit`, `a001-*` tests) and offline Playwright (`navigation-palette`, `a003-palette`, `shell-hierarchy`). This step records **hosted or session visual** gaps only.

**Session:** approved Preview (after HOLD lift) or designated local disposable backend; `NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE=full` where full-profile tabs apply. No production writes beyond what earlier rows already approved.

| Area | Routes / surfaces to spot-check | Notes |
| --- | --- | --- |
| Authenticated — platform | `/admin`, `/onboarding` | Session + layout chrome |
| Authenticated — job modules (no offline entry) | overview, billing, variations, drawings, change management, final account, handover documents, lessons learned, quick quote, live dashboard, P&L, reporting, intelligence, `data/*`, foundations, mobile hub, management-accounts, archive, communications, full contract-admin page, programme (standalone), library templates, case-study library editor, profile import/interview/readiness, integrations, api-keys | Primary actions on sage/charcoal, not legacy brand blue |
| Full-profile chrome | `ProjectNavBar` full tab row (overview → communications) | Static test exists; confirm in session |
| Auth lifecycle | `/auth/*`, password reset flows | Palette on forms and focus rings |
| Dynamic public | `/proposal/[token]`, `/supervisor/[token]`, `/guides/[slug]` | Token/slug-specific rendering |
| Company profile | `/dashboard/settings/profile` section chooser | Optional: offline `profile-sections` fixture first |
| Marketing (separate scope) | `/`, `/landing`, `/about`, `/apply`, … | A001 register: whole marketing site still Partial; note intentional deferral unless Rob expands scope |

Use the D28 route inventory in `docs/temp-files/a001-d28-evidence/verification.md` to enumerate any additional gap and record its result or explicit inbox deferral. Record PASS / NOT_RUN / FINDING per area in `d29/a001-…`. A001 stays **Partial** until marketing and every hosted row above are either walked or explicitly deferred in the inbox.

---
