# 7 December founding-cohort go-live runbook

DRAFT — documentation only. Prepared by Claude --model sonnet, corrected and source-checked by R1. Planned opening:7 December2026, conditional on the gates below. No runtime pass, schema application, live signup, publication or customer is claimed. Main baseline cfa6444220a1e2a0efc7b3282d56fcf62dce2bc8.

Use already-recorded exact Rob authority where it covers an action; do not ask him to approve the same step again. Sign-in provides access, not additional release/data/settings authority. This document grants none. R1 executes only within the recorded target, scope and safeguards; Rob owns account/hosting settings and unresolved business/release decisions. No force push, destructive rollback, credential sharing, live SQL or settings change is authorised by preparing this document.

## 1. Freeze candidates and owner gates — R1, with Rob supplying missing facts

Confirm the current five held schema heads and GitHub CI against the private schema-apply-runbook.md. Approved sequence is **176 →185 →222 →223 →224**, six files (176 has two). Retain the actual migration SHA256 manifest. AI-budget migration in228 is outside this sequence and stays held. Keep Phase2 drafts165–167 untouched.

Obtain the verified legal entity/address/registration, founding price/currency/billing/tax, discount/duration/enddate and working shared inbox; fill D76 placeholders in held227. Rob reviews exact rendered privacy, website terms, domestic proposal terms and pricing versions. Record separate publication/activation authority; no blanket approval inferred. Stop for missing facts/wording or edits after rendered-version approval. Undo: correct/revert drafts through normal Git commits, without publication.

## 2. Verify access, target, backup and protected practice copy — R1

Rob opens his existing session without sharing credentials. R1 verifies project identity and intended target, obtains the actual preapply function definitions, privileges and affected data backup, and verifies its recovery procedure privately. The repository predecessor RPC is a template, not a live backup. Verify the disposable nonproduction copy with the approved dummy users and the exact candidate. Existing preview guard currently blocks because nonproduction ref is absent while URL/anon target is production; no guard or settings bypass. Stop until the owner provides a properly configured protected preview/target through an authorised route. Undo: no apply/release occurs on failure; preserve the backup and receipts.

## 3. Validate and apply each package in order — R1 within existing exact authority; Rob owns any authority outside it

Apply only when all target/backup/preview/authority safeguards are actually met. Each package must pass the protected-preview check before any separately authorised target execution and code release. Migration-before-code is mandatory where required. Record actual target, head, migration hash, result and readback; stop at the first failure and do not advance. This runbook does not execute SQL or permit a main merge.

| Order | Migration under supabase/migrations/ | R1 immediate check | Data-preserving recovery |
|---|---|---|---|
|176a|20261115120000_d36_markup_method.sql|profiles/estimates fields, defaults/constraints; legacy NULL unchanged|Retain additive columns/values; stop before an old app can misprice on_net estimates.|
|176b|20261116140000_d36_phase1_project_graph_markup_method.sql|Actual graph RPC definition; new on_net and compound estimates, legacy compounded calculations and proposal note|Restore only verified actual preapply RPC/app when compatible with stored on_net values; otherwise forward-fix.|
|185|20261116103000_con018_profile_vat_settings.sql|NULL legacy VAT; registered/unregistered/rate/reverse-charge save/reload and owner isolation|Retain VAT values; revert compatible app, restore defaults only from actual prior snapshot.|
|222|20261118003000_con044_programme_planner_draft.sql|Planner autosave/reload same job, second-user isolation; programme/proposal unchanged until explicit Save to Proposal|Keep drafts/column; compatible app rollback or forward-fix, no draft erasure.|
|223|20261120032000_con073_pipeline_stage_history.sql|One event per actual stage move, none same-stage; owner read/insert isolation; update/delete refused|Retain append-only history; if authorised disable new inserts using recorded privileges, no event deletion. Status and event are separate operations, not atomic.|
|224|20261120040000_con068_estimate_line_included.sql|Explicit Included true on zero-price simple line persists after reload; legacy false and positive-price amounts unchanged|Keep flag/data; no old app if it misinterprets saved Included choices. Compatible app or forward repair.|

CI disposable replay/build/typechecks are preparation evidence, not hosted durability proof. Use actual preapply snapshot and recovery review if no safe compatible rollback exists; never drop columns/tables, truncate or erase user records. Code release needs applicable exact candidate authority and required checks, not just a successful SQL readback.

## 4. Close P0 and complete the later walkthrough — R1 then Rob

R1 records real protected-preview evidence for project creation, brief save/reload, admin/profile isolation and affected persistence/proposal/photo paths; independently review fixes and run affected required checks. CI is not a substitute. Only after P0 closure does Rob perform the later full walkthrough. Stop for an open P0 or any raised defect; repair and repeat affected checks. Undo: retain disabled signup/collection and all drafts/data. CON023 genuine latency remains postRC/nonblocking, owned by R1 when authorised observability exists; do not invent a new qualification gate.

## 5. Owner domain switch and release recheck — Rob then R1

Rob owns moving www.constructa.co and apex onto the intended current production project, with apex redirecting to www, using his owning account. Record the prior target/config privately for recovery. R1 makes no DNS/alias/settings changes. After Rob confirms completion and the candidate deployment is READY, R1 verifies exact production SHA and reruns the existing229 readonly11-page CI audit against the actual approved public origin; check routes, titles/meta/OG, mobile overflow, public links and console. Verify correct canonical target/TLS and keep forms/signup OFF. Stop on wrong deployment, failed guard, certificate or audit failure. Undo: Rob restores his recorded previous domain route; R1 preserves evidence and does not improvise settings.

## 6. Render, approve and publish exact pages — Rob approves, R1 packages within exact release authority

Fill only verified facts in227; legal/price and domestic clause approval stay distinct from signup/forms decisions. No placeholder, unapproved contract skeleton, invented price or testimonial may reach publication. Verify exact rendered pages and matching commit, then publish only under recorded applicable authority. Any postapproval text edit needs review of the changed version. Undo: normal source revert/approved prior deployment; keep collected/customer data intact. Preview takes no payment and sells no subscription until a separately approved real payment flow exists.

## 7. Set up forms and activate approved collection — Rob owns settings; R1 verifies approved route

Use only name, email, optional company and message; intended retention12months and Rob-only access. Verify the chosen inbox exists and receives through an authorised scoped test; confirm destination, access and retention before activation. Collection/routing initially stayOFF. Do not claim current storage by disabled forms. Record the exact mechanism for disabling collection from actual deployed configuration/source before switching anything on; do not assume a flag exists. Only activate after the specific remaining route/settings/release authority is met. Undo: Rob disables the actual verified route/settings, or R1 makes an authorised source revert; preserve existing messages, no deletes.

## 8. Enable signup and smoke the live journey — Rob approval/settings; R1 authorised checks

After step4 and applicable exact activation authority, Rob changes owned settings or R1 packages an explicitly authorised source change. Record the real switch and its reversal first; no imaginary feature flag. R1 verifies the intended target, actual signup gate, account/profile/project/brief/proposal flow and isolation through authorised test identities and scope. No real signup or live write occurs merely because this runbook exists. Stop on account, isolation, persistence or routing anomaly. Undo: turn off the actual verified signup/collection mechanism through its authorised owner; preserve accounts/submissions and report to Rob.

## 9. First founding customer — customer acts; Rob owns relationship, R1 observes only authorised evidence

Once released, the first real founding customer chooses to sign up and accepts their own terms; R1 does not accept contracts or create their account. Record only observed success/failure and the minimum authorised operational evidence, never credentials or raw identity in the public register. No invented signup/customer. On failure, halt new signups through the documented owner mechanism, preserve data and tell Rob. Rob handles customer communication and any consequential account decisions.

## Handoff receipt — R1

For each executed step retain exact authority, owner/time, candidate/deployment/target identity, check result and recovery reference privately. Advance the register only on actual remaining evidence. Keep incomplete owner, runtime, schema and publication directions open. This docs-only preparation may merge under D77 once reviewed and CI green; that does not execute the future launch steps.
