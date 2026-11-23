# R1 assessment and delivery status — D92 / D94

22 November 2026, main `78ee1c4cb26246931353ff4c9b3f5e8dc0d0260d`. This is the requested combined critique, not a release approval. The contractor workflow and cohort feature priorities below are the reviewer's proposed working model for Rob to assess, not statutory/tax advice or a universal construction standard. Source evidence distinguishes present full-profile features from the narrower cohort profile.

**R1 independently reproduced M1** using the actual TypeScript calculator and a separately checked transcription of the committed SQL: plain £14,610.75/£14,610.75; with £5,000 PC allowance £19,610.75/£21,916.13; blank prelims £14,610.75/£13,282.50; £500 credit £13,880.21/£14,610.75. This establishes a source mismatch, not the currently hosted function definition. No hosted SQL or publication was performed.

| Snag | Grade | Owner and result | Gate |
|---|---|---|---|
| D92-M1 | Must-fix | R1: additive RPC parity repair and real-RPC disposable regression cases in [draft #238](https://github.com/constructa-co/Constructa/pull/238). Independent review and exact CI receipts tracked there. | Schema draft only; outside the D86 approved apply sequence. Practice Unhealthy/No backups; no merge/apply. Reconcile exact candidate/order with held #176 before any future application. |
| S1–S5 | Should-fix | Existing VAT display, NULL/default and duplicate-calculation/presentation inconsistencies evidenced below; retain as recommendations, not new launch gates. | VAT/markup schema remain held. |
| S6 | Should-fix practice gap | Duration hint/time-based prelims can reuse current priced preliminaries; no auto-repricing proposed. | Product decision; not a demonstrated wrong estimate. |
| S7 | Should-fix source defect | R1 verified the last-week heuristic and the misleading “critical path” legend. Smallest suggested repair is truthful “Finishing in the final week” wording, not inventing CPM. | Follow-up recommendation; no claimed implemented fix. |
| S8 | Should-fix feature gap | Optional materials waste metric is missing, not a demonstrated defect. | Any column addition remains a draft for Rob. |

D94 adds no must-fix. Original Grok85 totals stay **63 closed /22 open /22 owner or operational-runtime gated**; D92-M1 is a supplemental new finding, not an invented 86th original item or a closure. Existing D78 journey/financial/parser tests were inspected; Sonnet did not rerun Vitest. The repair CI runs those original tests plus its actual RPC regression suite. No hosted/test pass is inferred from source reading.

The current source compounds. On-net is the intended default in held #176; applying its stored choices before compatible app/RPC code is accepted is unsafe. The draft repair supports optional stored on_net without creating a field/default. The report below predates that repair and remains an honest description of main.

---

# D92 estimate and pricing critique: brief → estimate → proposal

| | |
|---|---|
| Base | `78ee1c4` (branch `codex/d92-estimating-critique-20261122`; worktree clean at start) |
| Reviewer | Claude (`--model sonnet`), read-only (Read/Glob/Grep, plus one in-memory `node -e` harness) |
| Date | 2026-11-22 |
| Viewpoint | Small UK builder, groundworker or fit-out contractor |

## 1. Plain-English owner summary

**What is solid.** For an ordinary job the screen, the proposal total, VAT and the payment stages all agree. I hand-checked two jobs against the real calculation code and they matched to the penny. A groundworks job with a PC sum comes to **£10,710.97 before VAT and £12,853.16 including VAT**. The D78 journey figures come to **£10,754.13 / £12,904.96**. Input handling is careful and fails safe. That covers blanks, zero, negatives, huge values, decimals and commas. It also covers retry-safe saves, edit conflict checks, delete, and the discount reason rule. Proposal validity is a whole number of days from 1 to 365 and defaults to 30.

**One real defect (must-fix).** The final safety check at "Send" uses an older, simpler pricing rule than the screen. A job can show a correct price all the way through and then be refused at the last click. This happens when the estimate contains **any of these**:
- a prime-cost or provisional sum, together with any overhead, risk, profit or prelims percentage;
- a blank "Preliminaries" row, together with a prelims percentage above 0;
- a credit (negative) line.

The contractor sees a technical message ("Published contract sum does not match the active estimate") and has no way to fix it. Nothing wrong is ever sent, because the check fails closed. But prime-cost and provisional sums are routine in groundworks and fit-out, so this will hit real jobs. No test connects the screen's maths to that final check. D78 and D81 never publish, and the SQL test suite never calls the publish function.

**On-net pricing is not on `main`.** Your intended default is on-net, and `main` compounds in every place. On £11,000 of net cost with 10% overhead, 5% risk and 15% profit, `main` quotes **£14,610.75**. On-net would give **£14,300.00**, which is £310.75 (2.2%) less. The on-net work is the held D36 package (176a/176b), which is not in this tree. Section 6 lists what that package must also change, so it doesn't break publishing.

**Smaller issues.**
- The estimate screen always shows "VAT (20%)", even on a reverse-charge job, while the proposal correctly shows no VAT.
- Estimates created from different buttons start with different mark-ups: 0% on the first line, but about +39% on "new version".
- A few other places re-implement the sum.
- Waste allowance, CIS and reduced or zero-rate VAT are feature gaps (VAT registration is held under 185).

**Not established.** Nothing here has been run in a browser or on a hosted stack. The vitest suites were not run, and I do not claim a test pass. No SQL was executed. The held 176/185/224 files are not in this tree, so I could not read them.

### Must-fix list
| # | Finding | Evidence level |
|---|---|---|
| **M1** | The publish RPC's recomputed contract sum disagrees with `computeContractSum` for PC/provisional sums, blank Preliminaries rows and credit lines, so those proposals cannot be sent. | Source plus real-code arithmetic. The hosted function is unconfirmed. |

Everything else below is should-fix or nice-to-have.

## 2. Scope, method and limits

**Read:** `src/lib/financial.ts`, `simple-estimate.ts`, `estimate-mapping.ts`, `estimate-line-type.ts`, `proposal-publication.ts`, `proposal-review.ts`, `proposal-document.ts`, `proposal-readiness.ts`, `launch-profile.ts`. Also `costs/actions.ts`, `costs/simple-actions.ts`, `costs/estimate-client.tsx` (totals card), `costs/advanced-estimate.tsx` (line types, add-line, quantity and rate drafts), `build-up-panel.tsx`, `boq-excel-export.ts`, `live/page.tsx`, `proposal/actions.ts`. Also `supabase/migrations/20260930150000_proposal_publication_foundation.sql`, `20260117000000_foundations_estimator.sql`, `scripts/test-proposal-publication-sql.sh`, `e2e/d78-founding-journey.qa.ts`, `e2e/support/journey-data.ts`, `financial.test.ts` (53 `it` entries by static count), `simple-estimate.test.ts` (55), and the D69, D77 and D81 documents.

**Run:** one `node -e` harness, in memory, with Node v26.12.1. It transpiles the real `financial.ts`, `estimate-line-type.ts`, `simple-estimate.ts`, `discount-confirm.ts`, `launch-profile.ts` and `estimate-mapping.ts` with `/Users/robertsmith/constructa/node_modules/typescript`. The harness (Appendix A) executes them in a `vm`. No file was written and nothing was installed. The "SQL mirror" is my JavaScript transcription of lines 439–467 of the publication migration. It is **not executed SQL**.

**Not done:** no vitest, no build, no browser, no hosted or database access, no SQL. I did not read env files, credentials or other repos or worktrees. I did not run the pasted Python launcher. It would spawn a second `claude` and write the authority file, log, job JSON and inbox ACK outside this worktree. This report is the stdout deliverable only.

**Source tests vs hosted QA.**
- Everything below is source-level.
- The D78 journey is "draft, unverified in CI".
- D81 covers profile isolation and says nothing about pricing.
- No hosted pricing QA exists.

## 3. Worked examples (real pure code)

### A. Groundworks job, hand-checked
Lines at 85 m³ × £32.50, 24 m × £68, 18 m² × £92.40 and 6 days × £220 give 2,762.50 + 1,632.00 + 1,663.20 + 1,320.00 = **£7,377.70**. The estimate adds a £600 PC sum, with prelims 8%, overhead 10%, risk 3%, profit 12% and discount 0%.

| Step | Hand | Code |
|---|---|---|
| Prelims 8% | 590.216 | 590.216 |
| Construction | 7,967.916 | n/a |
| Overhead 10% | 796.7916 | 796.7916 |
| Risk 3% of (cost + overhead) | 262.9412 | 262.9412 |
| Profit 12% of running total | 1,083.3179 | 1,083.3179 |
| Marked-up total | 10,110.97 | n/a |
| + PC sum, at face value | 10,710.97 | **10,710.97** |
| VAT 20% | 2,142.19 | 2,142.19 |
| Total including VAT | 12,853.16 | **12,853.16** |

For the same lines, **on-net** would be 7,967.916 × 1.25 = £9,959.90, or £10,559.90 with the PC sum. That is £151.07 less.

### B. Reference job, compounding vs on-net
£10,000 of groundworks, prelims 10 / overhead 10 / risk 5 / profit 15:
- compounded **£14,610.75**; with VAT £17,532.90;
- on-net **£14,300.00**;
- the Risk row on screen reads £605.00 (5% of cost plus overhead), not £550.00 (5% of the £11,000 net). A contractor checking with a calculator will see the mismatch.

### C. D78 journey figures
The D78 journey data (`journey-data.ts:52-70`) has lines of £8,120 with overhead 10, risk 7.5 and profit 12. Compounded, that gives **£10,754.13**, VAT £2,150.83 and **£12,904.96**. On-net would give £10,515.40, which is £238.73 less. The D78 expected figures are hard-coded to compounding.

### D. Screen vs publish check
Using the reference job (10k, 10/10/5/15):

| Estimate shape | Screen and snapshot (TS) | Publish RPC recompute (SQL mirror) | Outcome |
|---|---|---|---|
| Plain 10k | 14,610.75 | 14,610.75 | match |
| + £5,000 PC sum | 19,610.75 | 21,916.13 | **refused** |
| + blank "Preliminaries" row | 14,610.75 | 13,282.50 | **refused** |
| + credit line −£500 | 13,880.21 | 14,610.75 | **refused** |
| Groundworks job A with its £600 PC sum | 10,710.97 | 10,933.25 | **refused** |

### E. Input matrix
This is the real parser, `buildPriceLine` and `buildAdjustments`. Only the rows that matter are shown.

| Input | Result |
|---|---|
| amount `0` | "Enter a price above £0." |
| amount `-5` | "Enter the price as a number, for example 2500." (the quantity field has a specific negative message; the amount field does not) |
| amount blank or spaces | "Enter the price as a number…" |
| amount `2500.555` or `1e3` | rejected, with the same "as a number" message |
| `1,234.50`, `£2,500` | accepted |
| `1.234,50` | rejected |
| `100000000` | accepted |
| `100000000.01` | "That price is too large." |
| qty `0.0005` | "Enter the quantity as a number." |
| qty `0.333` × £3 | accepted; line £1.00 (0.999 rounds up) |
| qty `-1` | "Quantity must be more than 0." |
| qty `1000001` | "That quantity is too large." |
| qty `1,5` / `1,000` | 1.5 / 1000 |
| qty `12.3456` | rejected |
| rate `0` | "Enter a rate above £0." |
| rate `0.005` | "Enter the rate as a number." |
| 99,999 × £1,000.01 | accepted; £99,999,999.99 |
| 1,000,000 × £100.01 | "That line total is too large." (shown on the rate field) |
| adjustment `10.5` | 10.5 |
| adjustment `10.555`, `-5`, `100.01`, `abc` | "Enter a percentage between 0 and 100." |
| adjustment `1,5` / `5%` / blank | 1.5 / 5 / 0 |

Rounding: `roundMoney(1.005)` returns `1`, so £1.01 hand-rounds to £1.00. `roundMoney(-3.345)` returns −3.34, whereas Postgres rounds half away from zero to −3.35.

## 4. Findings

### MUST-FIX

#### M1. The publish RPC recomputes the price with an older rule, so valid estimates cannot be sent
- **Where:**
  - TS rule: `src/lib/financial.ts:115-207`, the canonical function used for the screen, snapshot and publish payload.
  - SQL rule: `supabase/migrations/20260930150000_proposal_publication_foundation.sql:439-471`. This is the only definition of `publish_proposal_publication` in `supabase/` (grep).
  - Call site: `src/app/dashboard/projects/proposal/actions.ts:588-611`. The error is returned verbatim at line 610.
- **Reproduction (source, arithmetic):**
  1. Create an estimate with a £10k line, overhead 10, risk 5 and profit 15.
  2. In Advanced estimating, add a £5,000 line and set its line type to PC sum or Provisional sum (`advanced-estimate.tsx:86-95`).
  3. Review and Send. Section 3D has the numbers.
  - The same failure happens when someone clicks "Add line" under Preliminaries and leaves it blank. That creates a £0 row (`advanced-estimate.tsx:752-802`) and the RPC counts it as explicit prelims (`count(*) FILTER … 'Preliminaries'`, lines 444-447, 456-458). It also happens with a credit line, because Advanced accepts any finite number (`parseAdvancedQuantityDraft`, `simple-estimate.ts:78-83`, used at `advanced-estimate.tsx:1058,1132`).
- **Expected:** the RPC guard equals `computeContractSum`. Face-value lines sit outside the mark-up base. A zero-value prelims row does not suppress the percentage. Credit lines reduce the base. CON-016 (PR #198) and the later prelims fixes landed only in TS.
- **Actual (source):** the SQL has no `line_type` handling. It counts only lines with `line_total > 0` as direct cost, counts any Preliminaries row as explicit prelims, and marks up PC sums.
- **Why it matters:** the contractor reaches the final Send click and is blocked with an unexplained message. The failure is closed, so no wrong price is ever published. But PC and provisional sums are normal in groundworks and fit-out, and cohort contractors can reach all three triggers: Advanced estimating is in the base capability list (`simple-estimate.ts:379-389`), and `LINE_TYPES` is not capability-gated.
- **Test gap:**
  - `scripts/test-proposal-publication-sql.sh` never calls `publish_proposal_publication`. It calls only the `record_*` functions, and its fixture `estimates` table has no `discount_pct` and its `estimate_lines` table has no `line_type` (lines 60-75).
  - The e2e suite is deliberately no-publish (`e2e/PHASE1-NO-PUBLISH.md`).
  - D78 never publishes either (`d78-founding-journey.qa.ts:206-207`), and its estimate shape passes the guard.
- **Minimal repair (not applied here):**
  1. Add an additive `CREATE OR REPLACE FUNCTION publish_proposal_publication` in the held-schema process, mirroring the TS rules:
     - The direct base is the sum of non-Preliminaries lines whose type is not `pc_sum` or `provisional_sum` and whose total is not 0, including negatives.
     - The face value is the sum of lines with those two types and a total that is not 0.
     - Explicit prelims are the sum of non-face-value Preliminaries lines with a total that is not 0, if any exist. Otherwise prelims are base × `prelims_pct`/100.
     - Contract sum = round(construction × (1 + overhead) × (1 + risk) × (1 + profit) × (1 − discount) + face, 2).
  2. Add SQL fixture cases for PC sum, blank prelims and a credit line, with `line_type` and `discount_pct` columns, using §3A as the expected figure (10,710.97 for lines plus PC).
  3. Map error 23514 to plain English at `proposal/actions.ts:610`.
  4. Do **not** loosen the equality check. It is the integrity guard.
  5. If package 176b redefines this function, fold the fix into that single definition (see §6).
- **Confidence:** high on source. Hosted function text is unverified, and D77 §2 already requires the preapply definition. A protected-preview publish of a PC-sum fixture would confirm it, which falls within the existing D77 §4 evidence step and is not a new gate.

### SHOULD-FIX

#### S1. The estimate screen always charges 20% VAT, even for reverse-charge jobs
- **Where:** `simple-estimate.ts:212,278-286` (`VAT_RATE = 0.2`) and `estimate-client.tsx:1678-1683`, labelled "VAT (20%)" and "Total including VAT". The proposal uses the project's reverse-charge flag (`proposal-review.ts:532-536`; `proposal-document.ts:421-426`). `is_vat_reverse_charge` is not read anywhere under `costs/`.
- **Reproduction:** tick reverse charge in project settings (`settings/actions.ts:45`) and open the estimate. For the reference job the screen shows £17,532.90 including VAT. The sent proposal shows £14,610.75, "VAT domestic reverse charge applies".
- **Repair:** pass `vatFor(project)` into `summarisePrice`, or show the same note. Reduced rate, zero rate and VAT registration belong to the held 185 package.

#### S2. Estimates with NULL overhead/profit price differently on screen and in the proposal
- **Where:** `estimate-mapping.ts:18-23` turns NULL into overhead 10 and profit 15, but only `costs/page.tsx:73` and the pricing assistant use it. Proposal, billing, home and live read raw rows, where NULL becomes 0 (`toNumber`).
- **Reproduction (real code):** an estimate row with `overhead_pct` and `profit_pct` NULL and one £10,000 line shows **£12,650** on the estimate screen and **£10,000** to the proposal and billing.
- **Reach:** the columns have no default in the original migration (`20260117000000:29-30`). `library/templates-actions.ts:89-93` inserts an estimate with neither, but that path is in the full profile only. Legacy rows may also be affected, and the hosted data is unknown. D77 says 176a leaves legacy NULL unchanged.
- **Repair:** use one rule in both places (NULL → 0, matching what is published), or backfill via a migration.

#### S3. A new estimate starts with different default mark-ups depending on which button created it
- **Where:**
  - first Simple line: 0/0/0/0 (`simple-actions.ts:150-161`; deliberate, and the UI signposts it at `estimate-client.tsx:1687-1691`);
  - "new version": prelims 10, overhead 10, risk 0, profit 15 (`costs/actions.ts:60-73`, pinned at `advanced-versions.test.tsx:106`);
  - project-creation RPC: overhead 10, profit 15, risk 0, prelims 0 (`20260930120000_atomic_phase1_project_creation.sql:167-184`).
- **Effect (hand arithmetic):** a job at £10,000 in v1 becomes 10,000 × 1.10 × 1.10 × 1.15 = **£13,915.00** in a new version, about +39%. The totals card does show the adjustment rows.
- **Repair:** one defaults constant, decided together with the on-net work (§6).

#### S4. Other hand-written copies of the pricing rules
- **Where:**
  - `boq-excel-export.ts:89-116` (full profile only). It counts PC sums as marked-up direct cost, treats a blank prelims row as explicit prelims, drops negative lines, hard-codes VAT at 20%, and prints overhead, risk and profit rows with percentages and £ amounts in a "Priced_…xlsx" file. If that file goes to a client, those rows are visible.
  - `live/page.tsx:42-50,123-141`. The budget cost is correct when a PC sum exists, but otherwise it uses its own prelims rule (blank-row behaviour differs).
- **Why it matters:** the "one canonical sum" promise (`financial.ts:1-18`) is broken at several sites, and each new markup rule (on-net) must be added to each.
- **Repair:** route them through `computeContractSum` and `computeBudgetCost`.

#### S5. The published fee schedule silently absorbs credit lines
- **Where:** `proposal-publication.ts:325-328` omits credit lines from `fee_items`. Lines 360-377 push the rounding residual, here the credit × multiplier, onto the last marked-up line.
- **Effect:** the client sees a cheaper line item instead of an itemised credit. Visible only after M1 is fixed.
- **Repair:** publish credits as their own line, or block credits in Simple/Advanced with a clear message.

### NICE-TO-HAVE

- **N1. Parser messages.** Valid numbers with too many decimals (`2500.555`, `12.3456`, `0.0005`, rate `0.005`) get "Enter … as a number" (`simple-estimate.ts:138,147,152`). Say "up to 2 decimals" or "up to 3 decimals". Rates like £0.125 are not accepted. The negative-amount message is missing on the amount field.
- **N2. Units list.** `PRICE_UNITS` (`simple-estimate.ts:22`) has no `hr`, `sum`/`ls`, `load` or `bag`. Dayworks by the hour are common.
- **N3. Rounding.** `roundMoney` (`financial.ts:81-83`) uses float `Math.round`. The −12.34 case is pinned by a test, while Postgres rounds −12.345 to −12.35.
- **N4. Advanced numbers.** There is no range check or message for negative, zero, huge or sub-penny values (`costs/actions.ts:168-173,264-269`). `unit_rate` is `NUMERIC(12,2)` and quantity `NUMERIC(12,4)` (`20260117000000:71-73`), so a typed rate of £4.995 stores £5.00 but the line total uses the unrounded value. An overflow returns a raw database message. A 4-decimal quantity cannot be re-saved from the Simple editor (`draftFromLine` then `buildPriceLine`).
- **N5. Stale stored total.** The legacy `total_cost` fallback (`financial.ts:160-166`) prices an estimate with no non-zero lines at the stored total (real code: £9,999 for one £0 line). That is only reachable if the post-save refresh failed and the warning was ignored.
- **N6. Build-up hours.** Unit conversion hard-codes an 8-hour day and 40-hour week, and resets hours when the unit changes (`build-up-panel.tsx:946-953`). Hours do not feed cost.

## 5. Feature gaps (not defects)

| Topic | State on `main` |
|---|---|
| Labour rates and hours | A rate library and a build-up panel exist. Day rate and hours are independent fields, with a fixed 8-hour day. |
| Plant | There is a component type only. No hire vs owned, minimum hire, or delivery and collection. |
| Materials and waste | No waste or wastage factor anywhere. The area aid says "No unit conversion, waste or deductions are added" (`area-quantity-aid.tsx:21`). |
| Subcontract packages | A `subcontract` line type only. No CIS labour/material split, retention, or package comparison. |
| Preliminaries | Percentage or priced lines, with a note that explains the precedence (`simple-estimate.ts:263-271`). Good. Simple cannot add prelims lines. |
| Contingency / provisional sums | Risk % acts as contingency. Provisional and PC sums are face-value lines and good once published (see M1). |
| VAT | 20% or domestic reverse charge only. No 5%, 0% or exempt, and no VAT-registered switch. This is CON-018/185 (held), not duplicated here. |
| CIS | `computeCisDeduction` exists for cost and P&L only. No CIS note in the estimate or proposal. |
| Validity | Good: integer 1–365, default 30, `expires_at` computed. No tie to material price validity. |
| Exclusions and assumptions | Optional "recommended" items (`proposal-readiness.ts:244-245`). This is a product choice, and I am not suggesting a gate. |
| Discount | Reason required above 25%, with a confirmation. Good. |

## 6. Held package notes (D36 markup method: 176a/176b)

I am not re-raising the held snag. These verified facts matter for reviewing it:
1. **Main reads no markup field.** There are no `markup_method`, profile VAT or `included` columns anywhere under `src/`. `main` does not break if 176/185/224 are applied. `select("*")` carries extra columns harmlessly, but calculation ignores them. If 176 applies first, new on-net rows get compounded by `main`.
2. **Sites that need the method:** `computeContractSum`, `ohRiskProfitMultiplier`, `summarisePrice`, the `buildFeeItems` multiplier, the SQL publish guard, the Excel export and the live pages (see S4).
3. **The runbook lists no change to `publish_proposal_publication`** (D77 §3: 176a is columns, 176b is the project-graph RPC). If that is accurate, every on-net publication would be refused by the compounding-only guard. Fold M1 and the method rule into the same function definition.
4. **Tests that pin compounding and must change deliberately:** `financial.test.ts:101-121` ("not additive") and the `journey-data.ts` figures.
5. **UI copy** "added on top of your lines, in this order" (`estimate-client.tsx:1715`) will need to match the chosen method.

## Appendix A. Harness (reproduction)

Run from the worktree root. It reads files, transpiles in memory and writes nothing.

```js
const fs=require("fs"),vm=require("vm"),path=require("path");
const ts=require("/Users/robertsmith/constructa/node_modules/typescript");
const map={"@/lib/estimate-line-type":"src/lib/estimate-line-type.ts","./financial":"src/lib/financial.ts",
 "@/lib/discount-confirm":"src/lib/discount-confirm.ts","./launch-profile":"src/lib/launch-profile.ts",
 "./estimate-mapping":"src/app/dashboard/projects/costs/estimate-mapping.ts"};
const cache={};
function load(rel){ if(cache[rel])return cache[rel].exports;
 const out=ts.transpileModule(fs.readFileSync(path.join(process.cwd(),rel),"utf8"),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}}; cache[rel]=m;
 vm.runInNewContext(out,{module:m,exports:m.exports,
  require:r=>{if(map[r])return load(map[r]);throw new Error("unmapped "+r)},
  console,Number,Math,String,RegExp,Object,Array,JSON},{filename:rel}); return m.exports;}
const F=load("src/lib/financial.ts"), S=load("src/lib/simple-estimate.ts");
// SQL mirror of migration 20260930150000 lines 439-467 (a transcription, not executed SQL)
const r=x=>Math.round(x*100)/100;
function sqlSum(e,L){const d=L.filter(l=>(l.trade_section??"General")!=="Preliminaries"&&(+l.line_total||0)>0).reduce((s,l)=>s+ +l.line_total,0);
 const P=L.filter(l=>(l.trade_section??"")==="Preliminaries"),ep=P.reduce((s,l)=>s+(+l.line_total||0),0);
 const base=d>0?d:(+e.total_cost||0),pre=P.length>0?ep:base*(e.prelims_pct||0)/100;
 return r((base+pre)*(1+e.overhead_pct/100)*(1+e.risk_pct/100)*(1+e.profit_pct/100)*(1-e.discount_pct/100));}
// Cases: est {prelims 10, OH 10, risk 5, profit 15}; lines [10000 General]; + {5000, line_type:"pc_sum"};
// + {Preliminaries, 0}; + {-500}. Compare F.computeContractSumValue(est,L) with sqlSum(est,L).
```

**Outputs quoted above** came from running the harness, with `S.buildPriceLine` and `S.buildAdjustments` for the input matrix. They are an in-memory check, not a test-suite pass.

**Final status:** one must-fix (M1), five should-fix (S1–S5), six nice-to-have, and notes on held package 176.


---

## D94 supplement — contractor-practice pricing and programme map


Additional sections for the same D92 critique at `78ee1c4`, to follow D92 §6. Section numbers continue from D92 (7 to 11).

| | |
|---|---|
| Reviewer | Claude (`--model sonnet`), read-only (Read/Glob/Grep plus `git show`). No edits, SQL, installs, builds or tests. |
| Evidence | Source reading only. Nothing was executed, so there is no test pass to claim. Hosted behaviour is unknown. |
| Not re-diagnosed | M1 (publish RPC mismatch). On-net: intended default is held 176, `main` compounds. |

## 7. Owner summary

**Pricing.** The core of how a small contractor prices is on `main` and works. That means build-up lines (labour, plant, materials, consumables, subcontract, temporary works), preliminaries as a percentage or priced lines, overhead, risk and profit, PC and provisional sums, a discount, and 20% VAT or domestic reverse charge. It also covers payment stages with deposit and balance, and tender validity (1 to 365 days).

There are real feature gaps for a small builder:
- no waste allowance;
- no subcontract quote comparison;
- no CIS or retention terms in the quote;
- no dayworks rates schedule;
- no fluctuation or inflation clause;
- no per-unit plant minimum hire or delivery.

None of these is a demonstrated defect. They are wishlist items, so I grade none of them must-fix.

**Programme.** The programme is more complete than its cohort-profile shape suggests, and it is reusable.
- **Calendar:**
  - Working patterns come in two versions.
  - UK bank holidays are split by England and Wales, Scotland and Northern Ireland.
  - Region picks the division.
  - Start dates are checked for past dates and non-working days.
- **Durations:** an estimate-to-stage suggestion takes labour hours divided by productive hours per day.
- **Dependencies:** Finish-to-Start links are stored, with circular-dependency checks and drag reconciliation.
- **Planner and tracking:**
  - A drag Gantt planner.
  - Server-side planner drafts.
  - A published baseline.
  - Progress tracking with actual dates, % complete, revised finish and delay reasons.

The gaps are:
1. The "critical path" marker is not a critical path. It is "any stage ending in the last calendar week" (`schedule/client-page.tsx:547-556`).
2. There is no float.
3. The only link type is Finish-to-Start, with no lag or lead.
4. There is no lead-time or procurement activity.
5. Preliminaries do not depend on programme duration. This is the one structural link I would call a **should-fix**: it is how the price and the programme disagree, and it is the main finding of this section.

**Must-fix additions from D94: none.** M1 stays the only must-fix. Programme findings are should-fix at most.

**Existing features to reuse, not rebuild:**
- `programme-plan.ts`
- `job-working-pattern.ts`
- `uk-bank-holidays.ts`
- `programme-phase-dependencies.ts`
- the `/programme` live-tracking page (full profile only)
- the contract-admin delay analysis (full profile only)

## 8. Part A — How a small UK contractor prices a job, top down

1. **Enquiry and qualification.** Is it worth pricing? What is the client's budget, the programme pressure and the payment record?
2. **Read the drawings, specification and scope.** Note what is clearly in, clearly out and unclear. Write questions to the client or designer.
3. **Take-off and a bill or schedule of works.** Measure quantities by trade or work section. Small jobs use a schedule of works, with a few lump sums and some PC or provisional items.
4. **Build up each rate.**
   - Labour is gang size × hours × a loaded rate.
   - Plant is hire days or owned-plant charge-out, with delivery and collection.
   - Materials carry a waste percentage, delivery and supplier quotes, and a price validity.
   - Subcontract packages are obtained from two or three quotes and compared.
5. **Preliminaries.** Site set-up, welfare, scaffold, skips and waste, supervision, insurances, temporary works, and the site-wide time-related costs. These are driven by **how long the job takes**, not only by cost.
6. **Overheads and profit.** Applied as a percentage. On-net is the usual small-builder default (add the percentages to net cost). Compounding is an option.
7. **Contingency and risk.** An allowance for known unknowns.
8. **Provisional and PC sums.** Carried at face value and outside the mark-up, with a clear statement of what each covers.
9. **Daywork rates.** A schedule of hourly or daily rates for instructed extras.
10. **Exclusions, assumptions and qualifications.**
11. **Tender validity.** A date after which material prices or availability may change.
12. **Payment terms.** Deposit, stages, retention and a due date for each payment.
13. **Tax.**
    - VAT at standard, reduced or zero rate.
    - Domestic reverse charge where it applies.
    - CIS deductions on subcontract labour.
14. **Fluctuation or inflation allowance.** A lump or clause for longer jobs.
15. **Final check and submission.** Sense-check against £/m² or historic jobs, then send.

### 8.1 Pricing map: practice step or metric to `78ee1c4`

Status key: **C** captured, **P** partly captured, **M** missing, **N** not needed for small contractors.

| # | Step or metric | Status | Source evidence | Recommendation |
|---|---|---|---|---|
| 1 | Enquiry, pipeline value | **C** | `pipeline-value.ts`, `dashboard/page.tsx`; project `potential_value` | None. |
| 2 | Scope reading, brief, drawings | **C** | Brief step; `launch-profile.ts` lists `brief` (cohort) but `drawing-takeoff` and `video-walkthrough` are full only | Fine for cohort. Takeoff stays full-profile. Nice-to-have only. |
| 3 | Take-off, bill or schedule of works | **P** | Simple lines (qty × rate) and Advanced sections (`costs/advanced-estimate.tsx`). Area aid (`area-quantity-aid.tsx`) has no waste or conversion. `client-boq-import` is full only | Quantity entry is fine. A measured-item assistant is a wishlist item. |
| 4a | Labour build-up (role × days × rate) | **C** | `build-up-panel.tsx:664-730` (role picker, day rate from the labour rate library); hours per unit (`manhours_per_unit`) | Present. Hours do not feed cost (D92 N6). Documented. |
| 4b | Gang size and output rate | **P** | `manhours_per_unit` per component; no gang size or output field, only hours per unit | Hours per unit is the usual small-builder shorthand. Add nothing unless users ask. |
| 4c | Plant (hire days, owned) | **P** | Plant component picks a library item and rate (`build-up-panel.tsx:730-772`). No hire vs owned, minimum hire, or delivery and collection | Nice-to-have: an optional delivery line. |
| 4d | Material waste % | **M** | No waste field; area aid says no waste is added (`area-quantity-aid.tsx:21`) | Should-fix as a feature item, not a defect. A waste % on a material component is a small additive change. Needs a schema column: **draft only**. |
| 4e | Material delivery, supplier quotes, price validity | **P** | Material picker has library rate only (`build-up-panel.tsx:773-838`); no supplier or quote field | Nice-to-have. A free-text note on the line covers it today. |
| 4f | Subcontract quotes and comparison | **P** | `subcontract` component type, value entered as the rate (`build-up-panel.tsx:863-876`). No quote comparison or CIS split | Nice-to-have: a "quotes received" count on the line. Comparison is not needed for the cohort. |
| 5 | Preliminaries (priced lines or %) | **C** | `financial.ts:145-169`; precedence rule explained in `simple-estimate.ts:263-271` | Present. See 8.2 for the duration link. |
| 5b | Prelims **driven by programme duration** | **M** | No reference to programme or duration anywhere in `financial.ts` or `costs/` (grep). `manual_duration_days` is a legacy column on `estimates` (`schedule/actions.ts:57`, migration `20260117000007`), not used for cost | **Should-fix** (practice mismatch, not a defect). See 8.2 for the worked example. Smallest change: show a duration hint beside the prelims %, no schema change. |
| 6 | Overhead and profit | **C** | `financial.ts:115-207`; on-net held (176) | Covered by D92 §6. |
| 7 | Contingency or risk | **C** | Risk % (D92 §5) | None. |
| 8 | Provisional and PC sums | **C** | `estimate-line-type.ts`, `financial.ts` face-value handling | Publication refusal is M1, not repeated. |
| 9 | Daywork rates | **M** | `PRICE_UNITS` has no `hr` (D92 N2); no daywork schedule in the proposal. `contract-admin` and `variations` exist but are full only | Nice-to-have. Wishlist, not a defect. |
| 10 | Exclusions and assumptions | **C** | `proposal-readiness.ts` marks them recommended (D92 §5) | None. |
| 11 | Tender validity | **C** | `review-send-client.tsx:1127-1138`; integer 1 to 365 | None. |
| 12a | Deposit and balance, stage payments | **C** | `costs/payment-stages.tsx`; `review-send-client.tsx:1003-1020, 1444` | None. |
| 12b | Retention in the quote | **M** | `retention_percent` exists on the project type (`types/domain.ts:228`) but has **no non-test reader** in `src/` (grep). Retention fields on invoices exist (`domain.ts:394-397`) for billing, which is full profile | Should-fix? I judge it **nice-to-have** for cohort: most domestic jobs have no retention. Decide with Rob whether commercial work is in the cohort. |
| 13a | VAT standard and reverse charge | **P** | 20% and domestic reverse charge only (D92 §5, S1). Reduced and zero rate held under 185 | Already held. No change. |
| 13b | CIS | **N** for the quote | `cis` module exists (`dashboard/cis`) for cost and P&L. Not shown in estimate or proposal | CIS is a payment mechanism, not a quote line. Not needed for cohort. |
| 14 | Fluctuation or inflation | **M** | No field or clause in source (grep for `fluctuation`: none in the files read) | Nice-to-have. A standard clause paragraph is cheaper than a field. |
| 15 | Sense-check against benchmarks | **P** | `benchmark-api` is full only. No £/m² check in cohort | Nice-to-have. |

### 8.2 Worked example: duration and prelims

Illustrative figures. The arithmetic follows source, but the inputs are mine, not from a real job.

- **Hours to days** (`planner-phases.ts:153-200`):
  - A section "Groundworks" has total labour hours of 240 after multiplying each line's component hours by that line's quantity.
  - Productive hours per day come from the working pattern (`jobProductiveMinutesPerDay`).
  - With the default Monday to Friday pattern the source comments assume an eight-hour day (`schedule/actions.ts:216`). R1 additionally checked `job-working-pattern.ts:352-357`: the default is 480 productive minutes per day (8 hours); v2 uses its configured standardMinutesPerDay.
  - `calculatedDays = max(ceil(240 / 8), 1)` = **30 working days** = **6 weeks**.
- **Prelims** (`financial.ts:151-166`):
  - Take direct cost £10,000 and `prelims_pct` 10.
  - Prelims are £10,000 × 10% = **£1,000**, whatever the programme says.
  - If the contractor lengthens the stage from 6 to 12 weeks in the planner, prelims stay at **£1,000**. Nothing flags that a cabin, scaffold or supervision cost has doubled.
  - A contractor who prices by time (for example welfare £150 a week plus supervision £400 a week) would have £550 × 6 = **£3,300** for 6 weeks and **£6,600** for 12 weeks.
  - Both are plausible. The point is that source offers no link between them, and the user has to do this by hand.
- **Practical recommendation (Should-fix S6, below):** show the programme's working-day total next to the prelims allowance with the text "Prelims are priced on cost, not time. The programme currently runs N weeks." No schema change. A time-based prelims line (weeks × weekly rate) can reuse the existing priced Preliminaries lines in Advanced estimating, which already take explicit lines over the percentage.

## 9. Part B — How a small UK contractor builds a programme, top down

1. **Work breakdown** from the estimate sections or the schedule of works.
2. **Durations** = quantity ÷ (gang output per day), or labour hours ÷ (gang size × hours per day).
3. **Sequencing and dependencies**: Finish-to-Start, Start-to-Start, Finish-to-Finish, with lags (for example "plaster dries 5 days").
4. **Lead times** for materials, windows, steel, subcontractors and statutory approvals.
5. **Resources and gang sizes**, so two stages do not need the same gang at once.
6. **Working calendar**: weekends, UK bank holidays by nation, the Christmas shutdown, and a weather allowance for external work.
7. **Milestones**: start on site, key dates, practical completion, handover.
8. **Critical path and float.**
9. **Client-held items and approvals**, such as client decisions, building control and utilities.
10. **Contract dates and liquidated damages (LADs) awareness**: does the programme meet the contract completion date, and what does lateness cost per week?
11. **Baseline vs progress**: keep the original programme and record actual dates.
12. **Programme to estimate link**: time-related prelims, labour-hour totals, and cash flow against the programme.

### 9.1 Programme map

| # | Step or metric | Status | Source evidence | Existing feature to reuse | Recommendation |
|---|---|---|---|---|---|
| 1 | Breakdown from the estimate | **C** | `planner-phases.ts:153-200` groups estimate lines by `trade_section`; `getEstimatePhasesAction` (`schedule/actions.ts:195-255`); "General" is renamed "Works on site" (`planner-phases.ts:117-121`) | Yes | None. Simple estimates give one stage, which is correct. |
| 2a | Duration from labour hours | **C** | `planner-phases.ts:174-182` (ceil of hours ÷ productive hours, minimum 1 day; zero quantity flagged for review) | Yes | Pinned by `planner-phases.test.ts` (Tiling case, quantity 2, 12h + 4h). Whether the build-up panel's per-component hours are "per line unit" so this multiplication is right is **unknown** from source alone. A real-job check is a should-verify, not a defect. |
| 2b | Duration from quantity ÷ output rate | **M** | No output-rate field on estimate lines or components (grep: `output_rate`, `gang`, `crew`, `productivity` in schedule and costs: none beyond the working-pattern `productivityPct`, `job-working-pattern.ts:33`) | Partly: `productivityPct` is a pattern-wide factor | Not needed for small contractors. Hours per unit covers it. |
| 2c | Contractor override | **C** | `manualDays` over `calculatedDays` (`programme-plan.ts:154-163`) | Yes | None. |
| 3a | Finish-to-Start dependency | **C** | `dependsOn` (`programme-phase-dependencies.ts:4-8, 97-130`); circular check; successor snap | Yes | None. |
| 3b | SS / FF / lags | **M** | Only `dependsOn: number[]`, no type or lag. Comment in the earlier backlog says "SS-FS beyond Sprint 19 scope" (CLAUDE.md, deprioritised) | N/A | Nice-to-have. For small jobs, overlap is done by dragging. Lag is the more useful one ("plaster dry time"): a stage start offset already does it manually. |
| 4 | Lead times (materials, subcontractors) | **M** | No lead-time field in the phase shape (`schedule/actions.ts:96-107`; `PlannerPhase`) | None | Nice-to-have. A named stage such as "Order windows" already works as a placeholder, and the 6-stage simple limit (`simple-programme.ts:30`) is for simple mode only. |
| 5 | Resources, gang sizes, clash check | **M** | Phase has `manhours` only. Staff and plant catalogues and portfolio planning exist (`dashboard/resources/*`, full profile) but are not wired to phases (grep: no `crew`/`gang` in schedule) | Resources pages (full) | Not needed for the cohort. Wishlist. |
| 6a | Weekends and working days | **C** | Version 1 weekday set, version 2 timezone and intervals, `productivityPct` (`job-working-pattern.ts:15-45, 169-200`) | Yes | None. |
| 6b | UK bank holidays by nation | **C** | `uk-bank-holidays.ts` with divisions; region mapping (`resolveUkBankHolidayDivision`); a gov.uk feed overlay (`mergeGovUkBankHolidayFeed`); relative programmes note the E&W assumption (`relative-programme.ts:9-10`) | Yes | None. Hosted freshness of the feed overlay is **unknown**. |
| 6c | Christmas shutdown | **M** | No shutdown field in source (grep `christmas|shutdown`: no match in schedule files; the match in `uk-bank-holidays.ts` is bank holidays only) | None | Nice-to-have. The user can set a non-working pattern, but a one-off date range is not supported. |
| 6d | Weather allowance | **M** | No weather field (grep: none in schedule) | None | Nice-to-have. Handled by adding a stage or extra days manually. |
| 7a | Start date, completion date | **C** | `projects.start_date`; `programmeFacts` (`relative-programme.ts:87-97`); past-start warning; weekend-start edit test | Yes | None. |
| 7b | Named milestones and key dates | **M** | No milestone type. A zero-length stage is allowed as a flag only (`planner-phases.ts:95-97`, `needsReview`) | Partly | Nice-to-have. |
| 7c | Relative programme (no start date) | **C** | `computeRelativeProgramme` (`relative-programme.ts:45-74`); Day numbers only | Yes | Good fit for early tenders. |
| 8a | Critical path | **P** | Marker is "ends within the last calendar week" (`schedule/client-page.tsx:547-556`). Not a longest-path calculation | Marker UI | **Should-fix (S7).** Either compute the longest dependency chain from the existing `dependsOn`, or rename the marker "Finishes last". Today a stage that is not on the critical path can show a star. |
| 8b | Float | **M** | None | N/A | Nice-to-have once S7 is done. |
| 9 | Client-held items and approvals | **M** | No field. `contract-admin` holds events and notices (full profile only) | contract-admin (full) | Nice-to-have. A named stage "Client decision" works today. |
| 10a | Contract completion date, LADs | **P** | `contract-admin` has contract key dates and delay analysis (`contract-admin-client.tsx:182`, `DelayAnalysisTab.tsx:29`), full profile only. Proposal programme has no LAD or contract-date check. The grep for liquidated/LAD in `schedule`, `programme`, `settings` found no match | contract-admin (full) | Nice-to-have for the cohort. If the Terms step asks for LADs, a one-line warning "programme finishes after the stated date" is an easy addition. |
| 11a | Published baseline | **C** | `programme-client.tsx:129-141` uses the proposal plan as the baseline when it matches saved phases; falls back to the legacy start offset | Yes (full) | None. |
| 11b | Progress, actuals, delay reason | **C** | `pct_complete`, actual start and finish, `revised_planned_finish`, `delay_reason` (`schedule/actions.ts:136-154`, `programme-client.tsx:23-29`) | Yes (full) | None. Gated: `/dashboard/projects/programme` is not in the cohort route list (`launch-profile.ts:36-46`) while `/schedule` is. |
| 11c | Planner draft vs published | **C** | `autosaveProgrammePlannerDraftAction`, `clearProgrammePlannerDraftAction`; tracking fields stripped from the draft (`phasesWithoutTrackingFields`) | Yes | None. |
| 12a | Programme to prelims cost | **M** | See 8.2 | New small work | **Should-fix S6.** |
| 12b | Programme to labour totals | **C** | `totalManhours` and "N working days" in the KPI strip (`schedule/client-page.tsx:923-925`) | Yes | None. |
| 12c | Programme to cash flow | **M** | Payment stages are percentages of the contract sum (`costs/payment-stages.tsx`), not dated to programme stages | None | Nice-to-have. |

## 10. Programme findings, source-evidenced

- **P1 (should-fix, S6): prelims do not follow duration.** See 8.2. Source: `financial.ts:145-169` has no programme input. No file under `costs/` reads `programme_phases` or working days (grep: only a link and a note in `advanced-estimate.tsx:1732-1733`).
- **P2 (should-fix, S7): "critical path" marker is not a critical path.** `schedule/client-page.tsx:547-556`. It stars any stage ending in the last calendar week. A short stage in a parallel chain that ends last is starred, and a long chain that finishes a week early is not. The footer repeats "★ = critical path" (line 1281). The risk is a contractor making a decision on a wrong signal, which is why it is should-fix and not nice-to-have. Smallest repair: rename the label. Fuller repair: longest path over `dependsOn`, which already validates cycles.
- **P3 (nice-to-have): single link type and no lag.** `programme-phase-dependencies.ts:4-8`. Finish-to-Start only.
- **P4 (nice-to-have): profile gating of tracking.** `launch-profile.ts:36-46` allows `/schedule` for the cohort but not `/programme`, so baseline and progress tracking are full profile only. That matches the cohort's purpose (pre-contract) and is not a defect. A reviewer should not expect cohort users to see actuals.
- **P5 (not a defect): hidden capability.** The detailed planner is reached from the simple Programme screen only when the saved programme does not fit the simple shape (up to 6 stages, no overlap, dependencies or progress; `simple-programme.ts:110-111, 141, 186-196`). It needs a known start date (`simple-programme-client.tsx:233`). I would not describe that as missing. It could be hard to discover: a small builder with five stages will never see dependencies or the Gantt drag unless they add overlap. Unknown whether cohort users ever reach it. A test-user session would settle that.
- **P6 (unknown): hours multiplication.** `planner-phases.ts:167-168` multiplies component hours by line quantity. `build-up-panel.tsx:432` sets a component's `total_manhours = quantity × manhours_per_unit`. Whether component `quantity` is per one line unit (so the multiplication is right) or already a total (so hours double count) is not settled by the files I read. `planner-phases.test.ts:36-37` pins the multiplication as intended. I did not run it. **Unknown. Verify on one real job before relying on programme durations.**

## 11. Grading and reuse

### Grading for this supplement

| Grade | Items |
|---|---|
| **Must-fix** | None new. M1 (D92) stands. |
| **Should-fix** | **S6** prelims not tied to programme duration (no schema change needed for the hint). **S7** critical-path marker is not a critical path. **S8** (feature gap, not a defect): material waste % (needs a column, **draft only**). |
| **Nice-to-have** | Retention in the quote (cohort scope decision). Daywork schedule. Fluctuation wording. Lead time, lag and SS/FF links, milestones, Christmas shutdown, weather days, client-held items. LAD or contract-date warning. Delivery line for plant. Quote count on subcontract lines. £/m² check. |
| **Not needed (cohort)** | Gang size and output-rate duration. Resource clash checking. CIS in the quote. |

Wishlist gaps above are not demonstrated defects. Only S7 (a misleading label) and M1 are defects in the sense of a result that is wrong.

### Existing reusable features vs new work

**Reuse as is:**
- `programme-plan.ts`, `job-working-pattern.ts`, `uk-bank-holidays.ts`
- `relative-programme.ts` (no-start-date programmes)
- `programme-phase-dependencies.ts`
- planner drafts and save binding
- `programme-client.tsx` baseline and tracking (full profile)
- `contract-admin` delay analysis (full profile)
- `financial.ts` explicit prelims lines (the vehicle for a weeks × weekly-rate prelims line)

**New work, smallest first:**
1. Rename or compute the critical-path marker (S7). Source-only.
2. A duration hint beside prelims (S6). Source-only, reads the saved programme.
3. Material waste % (S8). Needs a schema column: draft for Rob, not applied.
4. Everything under nice-to-have. Only after cohort feedback.

### Not established

- Nothing was run, in a browser or elsewhere. No test results are claimed.
- Hosted behaviour is unknown, including the freshness of the bank-holiday feed overlay.
- Held packages 176, 185 and 224 are not in this tree.
- Whether cohort users discover the detailed planner (P5), and whether the hours multiplication (P6) matches the build-up panel, need a real job to settle.

**Final status:** no new must-fix. Two should-fix defects or mismatches (S6, S7) plus one feature gap (S8). The remaining gaps are nice-to-have.
