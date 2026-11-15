# D29 — Rob walkthrough runbook (draft)

**Status:** DRAFT · NOT APPROVED · NOT EXECUTED. Nothing in this document has been run, applied, deployed, published or sent.
**Date:** 2026-11-15 · **Prepared by:** Claude (docs-only pass, read-only against the repo)
**Candidate:** `fe1f2b14` — the checkout this was written at.

## 0. How to read this

### 0.1 Candidate identity

| Field | Value |
| --- | --- |
| Source baseline | `fe1f2b140f1617aa7a1d5ef9f93399f9ed127eab` |
| Deployment | Vercel confirmed this baseline. Before each check, record the current deployed SHA and confirm it contains the relevant source. |

"Candidate SHA" in each item below is `fe1f2b14` unless the item says another SHA is the relevant one.

### 0.2 Tags

| Tag | Meaning |
| --- | --- |
| **[ROB]** | Rob decides or performs it personally |
| **[OPERATOR-ONLY]** | Needs credentials, a hosted dashboard, a deployment, live SQL or a real third-party effect. The agent that wrote this did not and must not do it |
| **[READ FROM CODE]** | Stated from source or docs read in this pass, with the file named |
| **[UNVERIFIED]** | Not confirmed: either not readable here, or depends on live state or UI wording that was not seen |
| **[HELD]** | Blocked by a standing hold in `AGENTS.md`: Preview HOLD, real signup OFF, no merge without Rob's yes for the exact tested candidate, no deploy/settings/SQL/publication implied |

### 0.3 Operating authority

D29 asks for this walkthrough pack. Preview HOLD and real signup OFF remain in force. Review the current Constructa inbox before each gated operation.

### 0.4 Evidence destination (applies to every item)

Per `AGENTS.md`, private execution records live in `the private Constructa execution record`, and the register, changelog and handoff are updated by the owner in the same block as the work.

- **Primary:** a private receipt for the step, proposed path `d29/<item-id>-<UTC date>.md` within that record. Contents: candidate SHA, deployed SHA, what was done, what was observed, pass/fail/NOT_RUN per expected result.
- **Secondary:** an ACK/result line appended to the Constructa inbox, without clearing other entries.
- **Repo:** register (`walkthrough-action-register.json`), `docs/delivery/<date>/changelog.md` and `handoff.md` are updated by the coordinator, not by whoever runs the step. The compact register has 118 IDs; full history is private.
- **Never record:** keys, tokens, passwords, cookies, session values, full response bodies, real client data, real email addresses. A credential must not appear in a receipt even in part.

### 0.5 Standing rules for every step

- Do not run a step marked [HELD] on the strength of this document. It is a script for a decision, not the decision.
- Do not rerun a check whose result already exists for the same SHA; read the existing result.
- A passing step closes **only** the item's stated outstanding evidence. Do not force an item to Complete without it (`AGENTS.md`).
- Stop and report the exact blocker on the first unexpected result. Do not improvise a repair mid-walkthrough.

## 1. Order and dependencies

| # | Item | Register status | Depends on | Hosted/real effect |
| --- | --- | --- | --- | --- |
| 1 | A086 protected Preview | Partial | Preview HOLD lifted [ROB] | Preview deployment |
| 2 | A092 Cancel/Leave | Partial | A designated local session | None (local) |
| 3 | A089 timing | Partial | Exact release CI or an approved walkthrough observation | None |
| 4 | A105 / A106 containment | Partial | Operator vendor access | Revokes credentials |
| 5 | A074 migration + activation | Partial | Rob approves SQL and env change | Live SQL, redeploy |
| 6 | A038 live photo path | Partial | Rob approves migration + gate | Live SQL, env, storage |
| 7 | A023 terms/consent | Partial | Signup hold lifted, legal wording, migrations | Real (synthetic) signup |
| 8 | Analytics activation (A097) → A096 live measurement | Partial / Partial | Rebuild with build-time flag | Redeploy, Vercel dashboard |
| 9 | Kit acceptance | Partial (newsletter item) | Flag on; Rob's own address | Third-party subscriber record |
| 10 | A102 publication | Partial | Rob's approval of wording | Public posts |
| 11 | A103 publication | Not started | Code change + merge + deploy | Public page |

Record the approval and deployed SHA for each hosted change.

---

## 2. A086 — Protected Preview

**Register:** "Provide a separately protected, shareable phase-one Vercel preview for comments without replacing either current site." Status **Partial**, no evidence recorded in the compact register. **[HELD]**: `AGENTS.md` says "Preview remains HOLD".

**Candidate SHA:** `fe1f2b14`. Deployed Preview SHA: operator records.

### What the code does [READ FROM CODE]

- `src/lib/deployment/review-policy.ts`: review mode is on only when `CONSTRUCTA_REVIEW_ONLY=1`. It **throws** if `VERCEL_ENV` is set and not `preview`, or if `NEXT_PUBLIC_SUPABASE_URL` / `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF` do not match the declared test backend constants (`REVIEW_ORIGIN`, `REVIEW_PROJECT`).
- Pages are read-only: only `GET`/`HEAD`, and never under `/api`, `/admin`, `/proposal`, `/supervisor`, nor the auth callback/forgot/reset routes.
- Outbound fetches are limited to the review Supabase origin: reads of a fixed table allow-list as the review user, token refresh, and local logout.
- `CONSTRUCTA_REVIEW_EDITABLE=1` (`review-editable.ts`) additionally permits `POST` on `/dashboard/projects/costs`, `/schedule` and `/proposal`, only for the two named review jobs, only while those jobs are in a draft/pre-acceptance state. `proposal_cover_photo` is writable there only when the A074 gate is on.
- Root layout omits the analytics component when `CONSTRUCTA_REVIEW_ONLY=1`; `NewsletterSignup` renders nothing in review or `VERCEL_ENV=preview`.
- Build safety (`DEVELOPMENT.md`): a preview build fails unless the three Supabase variables and `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF` all name the disposable project; both checks print one `… -> PASS` line each.

### Steps

1. **[ROB]** Confirm in the current inbox that the Preview HOLD is lifted for this candidate. If not, stop; record NOT_RUN. **[UNVERIFIED — inbox not read]**
2. **[OPERATOR-ONLY]** Confirm, in the Vercel Preview environment only, that the following are set (names only; never values): `CONSTRUCTA_REVIEW_ONLY`, `CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; and that the Production environment is untouched. Keep the build command as `npm run build`.
3. **[OPERATOR-ONLY]** Create the Preview deployment from `fe1f2b14` (a deployment action; not implied by this document). Record the deployment ID and the deployed SHA.
4. **[OPERATOR-ONLY]** Read the build log for the two lines `Supabase target check: context=preview … -> PASS` and `Compiled Supabase target: context=preview … -> PASS`.
5. **[OPERATOR-ONLY]** Confirm Vercel deployment protection is on for the Preview URL (the "separately protected" requirement). **[UNVERIFIED]**: protection is a project setting that this pass cannot see and must not change.
6. **[ROB]** Open the Preview URL in a browser that is **not** signed in to Vercel. Expected: blocked by Vercel's protection page, not the app.
7. **[ROB]** Open it as a signed-in permitted Vercel user and sign in to the review account. Walk Company → Brief → Price → Programme → Proposal preview. Expected: pages load and show the review jobs' data.
8. **[ROB]** Attempt a save on a non-editable page and, if `CONSTRUCTA_REVIEW_EDITABLE` is not set, on the costs page. Expected: the save is refused (server message `REVIEW_READ_ONLY_REQUEST_REFUSED` / `REVIEW_EDIT_REQUEST_REFUSED`); no row changes.
9. **[ROB]** Visit `/proposal/<anything>`, `/admin`, `/api/…`. Expected: not served in review mode.
10. **[ROB]** Confirm the two existing sites are unchanged and still resolve to their own deployments (the "without replacing either current site" requirement). **[OPERATOR-ONLY]** to read the domain assignments.

### Expected result

Build PASS lines present; the Preview URL is protected; read-only behaviour holds; no analytics beacon or newsletter form; production and the existing sites untouched.

### Evidence destination

Private receipt `d29/a086-…`; screenshots of the protection page and a refused save (no customer data); deployment ID and SHA. Coordinator updates the A086 register entry. A086 stays **Partial** until this exists; the rest of the A086 Preview feedback loop (shareable comments) is not exercised by these steps.

---

## 3. A092 — Robert operating Cancel and Leave

**Register:** "Close confirmation-dialog evidence in one designated local QA session with Robert operating Cancel/Leave when ready." Status **Partial**. An earlier snapshot (`docs/backup-snapshots/2026-10-20/walkthrough-action-register.md`) adds: automated prerequisites and the exact owned clean/dirty state come first; **no retry of known broken focus/dismiss paths or other-tab interference**.

**Candidate SHA:** `fe1f2b14` (local run). **Not [HELD]** by itself, but it needs a running local app and an account, which is operator setup.

### What the code does [READ FROM CODE]

- Project settings (`src/app/dashboard/projects/settings/client-page.tsx`, route `/dashboard/projects/settings`) uses `useUnsavedGuard` (`src/lib/use-unsaved-guard.ts`): while the form is dirty, a **reload/tab close** triggers the browser's `beforeunload` prompt, and a **click on an in-app link** triggers `window.confirm`.
- The in-app confirm text is exactly: "Your project settings have changes that are not confirmed saved. / Press Cancel to stay here, or OK to leave without saving them." (`form-state.ts`). That is a native dialog with **OK / Cancel**.
- The browser's own unload prompt, not the app, supplies any "Leave" button. Its wording is browser-dependent. **[UNVERIFIED]**
- The case-study guided editor has a separate leave confirmation, "You have changes that aren't saved. Leave without saving them?" (`src/lib/case-library/guided.ts`), reachable only when `CONSTRUCTA_CASE_LIBRARY=1`.
- Buttons that save before navigating are not links and are not guarded.

### Steps

1. **[OPERATOR-ONLY]** Start one designated local app session (candidate `fe1f2b14`, disposable backend, `npm run dev` per `DEVELOPMENT.md`) with one owned account. Record the SHA, the browser and version, and that no other tab is open to the app. Whether this uses the existing `e2e/local-phase1` harness or a hand session is **[UNVERIFIED]**; use whichever the inbox designates.
2. **[OPERATOR-ONLY]** Run the existing automated prerequisites for the settings page first; record their result rather than rerunning anything unchanged.
3. **Clean state.** Open `/dashboard/projects/settings` for an owned project without editing. **[ROB]** Click a sidebar link. Expected: **no** dialog; navigation happens.
4. **Dirty state, Cancel (link).** Return, change one field, click a sidebar link. **[ROB]** presses **Cancel**. Expected: dialog shows the text above; you stay on the page; the edit is still in the field.
5. **Dirty state, Leave (link).** Click the link again; **[ROB]** presses **OK**. Expected: navigation happens; the edit is not saved. Re-open the page and confirm the saved value is unchanged.
6. **Dirty state, reload.** Change a field, press browser reload. **[ROB]** chooses the stay option (Cancel), then repeats and chooses Leave. Expected: stay keeps the edit; leave reloads with the saved value. Record the exact button labels the browser shows.
7. **Save then navigate.** Change a field, press the page's Save, then click a link. Expected: no dialog once saved.

If any dialog fails to appear, dismiss unexpectedly, or loses focus, **stop and record it**; do not retry the known broken focus/dismiss paths.

### Expected result

Cancel keeps the page and the unsaved edit; OK/Leave navigates and discards; clean and saved states never prompt.

### Evidence destination

Private receipt `d29/a092-…` with the SHA, browser/version, and PASS/FAIL per step 3–7; a short screen recording or screenshots of each dialog. The operating of Cancel/Leave must be by Rob personally for the item to read as closed. Coordinator updates the A092 register entry.

---

## 4. A089 — Production timing of the Git-check fixture

D24 closed the fixture diagnosis after two instrumented runs passed. Browser runs passed 2/2 in 4.7 s and 4.6 s. Git guard passed 10/10 twice. The timing instrumentation merged in #158 at `e26d29ac`.

**Candidate SHA:** Use the deployed SHA containing `e26d29ac`. Record it in the receipt.

### Steps

1. Review the timing already available from the exact release candidate CI run. Record fixture stage times, the Git guard result and any timeout.
2. If the deployed session needs a timing observation, Rob chooses the approved read-only or synthetic walkthrough route. Capture durations on that route. Any hosted write requires its own approval.

### Expected result

The receipt identifies the candidate and measured stages and records any timeout with its stage. If timing is unavailable, record the missing evidence.

### Evidence destination

Private receipt `d29/a089-…` and the CI or deployment receipt. Update A089 with the observation.

---

## 5. A105 / A106 — Containment of exposed credentials

**Register:**

- **A105:** "Confirm and contain the public Perplexity agent-proxy credential, explain its access and consumers, and give Rob verified revocation/replacement steps." **Partial.**
- **A106:** "Confirm the historical Supabase PAT exposure, determine scope/consumer risks and explain safe revocation and least-privilege replacement." **Partial.**

**Candidate SHA:** `fe1f2b14` for the repo checks. The exposure itself lives in **history and in vendor accounts**, not in this SHA's tree.

**No credential value appears in this document and none should be written into any receipt, chat or ticket. Refer to a credential only by its name and which vendor account holds it.**

### What exists in the repo [READ FROM CODE]

- `.gitleaks.toml` has two custom rules: `constructa-perplexity-agent-proxy` (agent-proxy bearer tokens) and `constructa-supabase-personal-token` (Supabase personal access tokens, "including legacy and scoped forms"). CI runs a checksum-pinned Gitleaks 8.30.1 (`secret-scan.yml`, per the A093 review).
- A107 (local MCP untracking/ignore plus secret-scanning guard) is Complete.
- `CLAUDE.md` (stale; dated 6 Apr 2026) says a Supabase token "Constructa CI" was rotated on 3 Apr 2026 and is held in the shell as `SUPABASE_ACCESS_TOKEN`. That tells you a consumer exists (shell/CI migration pushes); it does not tell you the current exposed token is that one. **[UNVERIFIED]**
- Not found in the files read: the consumer list for the Perplexity credential, the age of either exposure, or any recorded revocation. **[UNVERIFIED]**

### Steps

1. **[OPERATOR-ONLY]** Establish the facts without using the credentials: where each was exposed (file, commit, URL), when, and whether that location is still public. Use the retained scan result for history if one exists in the private folder; otherwise run Gitleaks against history with the repo config (local, read-only). **Never call a vendor API with the exposed credential to "test" it** — that is a live use of a leaked secret and can itself trigger effects.
2. **[OPERATOR-ONLY]** For each credential list its consumers: scripts, CI secrets, local environment files, MCP configs, other machines. Search for the **name** of the environment variable, not the value.
3. **[ROB]** Choose revoke-then-replace or replace-then-revoke for each consumer set (replace-first avoids breaking CI; revoke-first is faster if the exposure is active). Record the choice.
4. **[OPERATOR-ONLY] Supabase PAT (A106):**
   a. Create a replacement from the Supabase account's access-token settings, scoped as narrowly as the current Supabase UI allows. **[UNVERIFIED]**: the available scope options and exact menu path were not checked against current Supabase docs; check before relying on this.
   b. Update each consumer (CI secret, shell `SUPABASE_ACCESS_TOKEN`) directly in its own secret store; do not paste the value anywhere.
   c. Revoke the exposed token in the same account settings.
   d. Confirm the issuer records revocation and verify a dependent using the replacement through an approved read-only check.
5. **[OPERATOR-ONLY] Perplexity agent-proxy credential (A105):** use the issuing account to rotate and revoke it. Record issuer confirmation and verify approved dependents with the replacement.
6. **[OPERATOR-ONLY]** Record the issuer receipts and read the existing secret-scan result for the release candidate. Investigate any new finding through the private containment record.
7. **[ROB]** History rewrite is a separate decision (A108 advises on it). Rotation does not depend on it and must not wait for it.

### Expected result

Both exposed credentials revoked; replacements in place and working; issuer revocation verified; a written consumer list; a statement of what each could access; secret scan clean on the tree.

### Evidence destination

Private receipt `d29/a105-…` and `d29/a106-…` containing: vendor, credential **name**, date/time of revoke and replace, consumers updated, issuer revocation confirmation (yes/no), exposure window. No values, no prefixes or suffixes. The explanation of access/consumers that A105/A106 ask for goes to Rob in the inbox. Coordinator updates both register entries; each stays Partial until the revoke-and-confirm evidence exists.

---

## 6. A074 — Cover-photo migration and activation

**Register:** "Offer an appropriate real cover photo or clearly labelled design/before-after render." **Partial.** `evidence20261113`: "#109 approved the cover and #114 shipped it with a fallback and disclosure. Walkthrough pending." This checkout also holds the D27 gate (`93f7c31`, merged via #156): the feature is **off by default** until the column exists.

**Candidate SHA:** `fe1f2b14`. **[HELD]** for live SQL and for any deployment.

### What the code does [READ FROM CODE]

- Migration `supabase/migrations/20261114201500_a074_proposal_cover_photo.sql`: `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS proposal_cover_photo TEXT;` in a transaction. Additive and nullable. The change log says it was **not applied** when written; its present state anywhere is **[UNVERIFIED]**.
- `src/lib/proposal-cover-photo.ts`: all reads, writes, UI and publication stay off unless the **server** env `CONSTRUCTA_PROPOSAL_COVER_PHOTO` is exactly `1`. Comment: set it only after the column exists in production.
- Choices: none (default, legacy), `site` (first site photo; refused if there are none), `illustrative_render`.
- The illustrative render is `/Setting us apart.png` with the mandatory caption "Illustrative design render — not a photograph of completed work." `resolveProposalCoverPhoto` returns this primary for `illustrative_render`; a fallback helper (`minimalist infographic cluster of small construction buildings.png`, caption "Illustrative artwork — not a photograph of completed work.") exists, and where it is used in the UI was **not confirmed**.
- Gate off: the save omits the column, the cover controls are hidden, previews ignore any stored choice, and the review-editable allow-list excludes the column. Publication snapshots carry `cover_photo` only when on; legacy snapshots are unchanged.

### Steps

1. **[ROB]** Approve, in writing in the inbox, the target for this rollout (disposable/QA first, then production) and the exact migration file above. **[HELD]** until then.
2. **Gate-off baseline.** **[OPERATOR-ONLY]** On the target, with the env unset, open a project's Review and Send page. Expected: no cover controls; save works; a published proposal looks exactly as before (this is the pre-migration safety property).
3. **[OPERATOR-ONLY — live SQL]** Apply the migration to the target using the approved route (the repo's `DEVELOPMENT.md` says migrations are drafts until the owner applies them). Not done by this document or by the agent.
4. **[OPERATOR-ONLY]** Verify the column exists with a read-only catalog check: `public.projects.proposal_cover_photo`, type text, nullable. Record yes/no only.
5. **[OPERATOR-ONLY]** Set `CONSTRUCTA_PROPOSAL_COVER_PHOTO=1` in the target's server environment and redeploy (the comment says "at deploy time"). Record the deployed SHA.
6. **[ROB]** On a synthetic/draft project, open Review and Send. Expected: a cover choice with three states: no cover (default), "First site photo", "Illustrative design render".
7. **[ROB]** Choose "Illustrative design render". Expected: preview shows the Setting-us-apart render with the exact caption above. Save, reload, confirm the choice persisted.
8. **[ROB]** Choose "First site photo" on a project with no site photos. Expected: a validation refusal, not a blank cover.
9. **[ROB]** With a site photo present, choose it. Expected: first photo as cover, caption "Site photograph." or its own caption.
10. **[ROB]** Publish a **draft/synthetic** proposal, open the client page and download the PDF. Expected: cover and caption match in both. **[HELD]** against any real client send.
11. **Rollback check.** **[OPERATOR-ONLY]** Unset the env and redeploy. Expected: controls disappear, previously published proposals still render, saves still succeed.

### Expected result

Column present; gate on shows three choices; the render is always captioned as not a photograph; web and PDF match; gate off restores the legacy behaviour with no errors.

### Evidence destination

Private receipt `d29/a074-…`: candidate and deployed SHA, migration applied yes/no with timestamp, env set yes/no, screenshots of the preview, published page and PDF cover (synthetic data only). Coordinator updates the A074 register entry. The primary render and caption were approved. Record the gated migration, activation and cover result separately.

---

## 7. A038 — Live photo path (case studies)

**Register:** "Retain up to three photos and optional AI enhancement within the improved case-study journey." **Partial.** `evidence20261107`: legacy save refuses more than three photos; "Library wire photos/AI enhance still off; photos migration unapplied." `evidence20261113`: #116 added offline photo-save refusal coverage; "Hosted photo evidence is open."

**Candidate SHA:** `fe1f2b14`. **[HELD]** for live SQL, storage and env changes.

### What the code does [READ FROM CODE]

- The library is gated by server env `CONSTRUCTA_CASE_LIBRARY=1` (default off; `src/lib/case-library/gate.ts`). It needs `20261012090000_case_library_foundation.sql`; photos need `20261028120000_case_library_photos.sql`. Whether either is applied anywhere is **[UNVERIFIED]** (the 7 Nov note says photos was unapplied then).
- The older case-study editor is unchanged either way and refuses a fourth photo with `LEGACY_CASE_STUDY_PHOTOS_MESSAGE`; a refused save keeps the draft and baseline.
- **AI enhancement is hard-coded off in source** (`CASE_STUDY_TEXT_ENHANCE_ENABLED = false` in `src/lib/cohort-ai/case-study-enhance-enabled.ts`). The only way it turns on at this SHA is `CONSTRUCTA_IMPORT_FIXTURE=1` / `NEXT_PUBLIC_CONSTRUCTA_IMPORT_FIXTURE=1`, which are test-fixture switches. **Do not set either on a real environment.** Activating AI enhance is a code change and a separate Rob decision, so it is out of scope here.
- Storage bucket and policy names for case photos were not located in the files read. **[UNVERIFIED]**

### Steps

1. **[ROB]** Approve, in the inbox, the target and the two migrations, plus the photo storage setup. **[HELD]** until then.
2. **[OPERATOR-ONLY]** On the target, check read-only whether the foundation and photos migrations are present (record yes/no for each). If either is absent, apply them only with approval (live SQL) and record the timestamp.
3. **[OPERATOR-ONLY]** Confirm the photos storage bucket and its policies exist. **[UNVERIFIED]** — read the photos migration to learn the expected names first.
4. **Legacy path.** **[ROB]** On Company → Case Studies (older editor), attach three photos and save. Expected: saved; reload shows three. Attach a fourth and save. Expected: refusal message; draft keeps all four on screen, the saved record still holds three.
5. **[OPERATOR-ONLY]** Set `CONSTRUCTA_CASE_LIBRARY=1` on the target, redeploy, record the deployed SHA.
6. **Library path.** **[ROB]** Open the case-study library, create a case study, add up to three photos, save, reload. Expected: photos persist and display; a fourth is refused or not offered.
7. **[ROB]** Tick that library case study on a draft proposal and view the proposal preview. Expected: the case study and its photos appear. A separate approved gate-off check can confirm a saved library selection still resolves.
8. **AI enhancement.** Not exercised. Record NOT_RUN with the reason: off in source.

### Expected result

Three photos retained, a fourth refused with an honest message, photos persist across reload on the live path, and proposal integration works. AI enhancement remains off.

### Evidence destination

Private receipt `d29/a038-…`: migration and bucket presence yes/no, deployed SHA, screenshots (synthetic photos only, no client imagery), and an explicit NOT_RUN for AI enhance. Coordinator updates the A038 register entry; it stays **Partial** while AI enhance is off.

---

## 8. A023 — Platform terms and consent

**Register:** "Add Constructa platform terms acceptance at signup, with an explicit checkbox and accessible full terms." **Partial.** `evidence20261113`: "#110 defined stored consent evidence, #112 added offline checks, and #127 repaired the blank site URL redirect. Hosted consent is open." Earlier entries: consent schema applied to the verified QA project in the earlier A023 work; real current-consent acceptance **NOT_RUN**; legal wording and migration approval still needed from Rob (7 Nov).

**Candidate SHA:** `fe1f2b14`. Relevant earlier SHA: `7e0dcef` (checkbox + server gate). **[HELD]**: real signup is OFF and `AGENTS.md` says do not force A023 Complete without the actual remaining evidence.

### What the code and docs say [READ FROM CODE]

- `docs/delivery/2026-11-12/consent-record-evidence.md`: the outstanding evidence is **a stored acceptance for a verified synthetic account, with the expected terms revision, and the first-sign-in path when signup could not record it**. Use the existing operator-assisted consent harness only after separate approval of the disposable target, synthetic account and hosted writes. Passing needs one matching consent record, the expected revision, and a successful return from the completion screen for the matching session. No hosted test had been run when it was written.
- Enforcement switch: server env `CONSTRUCTA_PLATFORM_TERMS_ENFORCEMENT=on` (default off; any other value is off) routes a signed-in user with no acceptance of the current revision to `/auth/platform-terms` before `/dashboard` and `/onboarding` (`src/proxy.ts`, `src/lib/platform-terms-gate.ts`). A missing table or failed lookup lets the user through. `/auth/*`, `/login`, `/admin` and public proposal routes are not gated.
- Migrations (drafts until the owner applies them, per `DEVELOPMENT.md`): `20261024122500_platform_terms_acceptance.sql` and `20261114032000_platform_terms_per_version_acceptance.sql`.
- The name of the "existing operator-assisted consent harness" and the "established restricted reader" was **not found** in the files read. **[UNVERIFIED]**
- Terms wording: whether the terms page still carries placeholder wording or Rob-approved legal text was **not confirmed** (the 7 Nov note said placeholder). **[UNVERIFIED]**

### Steps

1. **[ROB]** Confirm in the inbox: (a) the signup hold is lifted for this synthetic test, (b) the disposable target, (c) the synthetic account identity, (d) hosted writes allowed, (e) legal wording approved. All five are needed. **[HELD]**
2. **[ROB]** Read the signup terms page and the checkbox wording at the candidate. Confirm the text is final legal wording, not a placeholder.
3. **[OPERATOR-ONLY]** Run the existing target guard on the candidate build (`verify-build-supabase-target`) and confirm the consent migrations are present on the target (metadata only). Apply any missing one only with approval (live SQL).
4. **[OPERATOR-ONLY]** Cover the unrecorded branch with the existing offline fixture first (per the evidence note), before any hosted write.
5. **[OPERATOR-ONLY]** Decide the enforcement setting for the test (`CONSTRUCTA_PLATFORM_TERMS_ENFORCEMENT`), record it, and redeploy if it changes.
6. **Acceptance.** **[ROB]** With the synthetic account only: attempt signup without the checkbox. Expected: refused with an accessible message. Tick the checkbox, accept, complete the email verification step. Expected: returned from the completion screen for the matching session.
7. **Read-back.** **[OPERATOR-ONLY]** Using the established restricted reader, confirm exactly one acceptance row for that account with the expected revision. Record the revision and yes/no; no account data, tokens or response bodies.
8. **First-sign-in path.** **[ROB]** Where signup could not record acceptance, sign in and confirm routing to `/auth/platform-terms` and that completing it records one row.
9. **Clean up per the inbox rule for the synthetic account.** Do not touch real users.

### Expected result

Refusal without the checkbox; one matching row with the expected revision; successful completion-screen return for the matching session; the first-sign-in recovery path works.

### Evidence destination

Private receipt `d29/a023-…`: SHA, deployed SHA, enforcement setting, revision, yes/no per expected result. Coordinator updates the A023 register entry. A023 stays **Partial** until a single run produces all of the above. The A023-related review draft `docs/reviews/2026-11-14-a023-signup-terms-consent-redteam-draft.md` was referenced elsewhere but not read here.

---

## 9. Analytics activation (A097) and A096 live measurement

**Register:**

- **A096:** "Audit existing analytics/newsletter work against current requirements before replacing or adding tools." **Partial.**
- **A097:** "Define and implement useful acquisition/conversion measurement with a justified primary analytics choice." **Partial.** `evidence20261113`: "#124 added marketing analytics code. Hosted activation and measurement are open."

**Candidate SHA:** `fe1f2b14`. **[HELD]** for the rebuild/deploy and the Vercel dashboard change.

### What the code does [READ FROM CODE] (`docs/marketing/public-measurement-spec.md`)

- Primary choice: **Vercel Web Analytics** for page views. Plausible stays in the admin website tab only (needs a Plausible API key; no public loader). GA4 and Search Console are not used.
- Page views are **default-off**. They collect only if `NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS=1` **at build time**, and Web Analytics is enabled for the project in the Vercel dashboard. Until both, nothing is sent.
- Even when on: nothing in review-only mode; nothing off an explicit public-route list (`/`, `/landing`, `/about`, `/apply`, `/contact`, `/pricing`, `/features`, `/product`, `/customers`, `/privacy-policy`, `/terms-of-service`, `/guides/*`); nothing while a Supabase session cookie is present; the URL is cut to origin + path (no query, fragment or credentials).
- Custom events are **disabled** (`PUBLIC_MEASUREMENT_COLLECTION_ENABLED = false`). So conversion events (`ContactFormSubmit`, `TryConstructaClick`, `WaitlistSubmitAttempt`) forward nothing. UTM parameters are not recorded.
- The admin metric "signups ÷ rolling 30-day Plausible visitors" is not session-attributed conversion and must not be called that.

### Steps

1. **[ROB]** Decide to activate page-view measurement for the public site (and which environment). Note the consequence: no custom-event conversion data and no UTMs will exist afterwards. **[HELD]**
2. **[OPERATOR-ONLY]** Set `NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS=1` for the chosen environment, then **rebuild** (it is a build-time variable; changing it without a rebuild does nothing). Record the deployed SHA.
3. **[OPERATOR-ONLY]** Enable Web Analytics for the project in the Vercel dashboard.
4. **Positive check.** **[ROB]** In a private window with no Constructa session, visit `/`, `/pricing` and `/features`. Expected: a page-view beacon is sent; the request URL carries no query string (visit once with `?utm_source=test` and confirm the parameter is absent).
5. **Negative checks.** **[ROB]** Expected **no** beacon on: `/dashboard`, `/login`, `/onboarding`, `/admin`, a `/proposal/<token>` page; on a public page while signed in; and on a Preview/review deployment.
6. **Dashboard check.** **[OPERATOR-ONLY]** After a short delay, confirm the Vercel Web Analytics view shows the positive-check page views and not the negative ones. Record counts and paths only.
7. **A096 audit statement.** **[ROB]** Confirm the audit conclusion: Vercel Web Analytics is the live page-view tool; Plausible is admin-only; custom events are off; newsletter handling is item 10 below. Anything the audit adds or replaces needs its own decision.

### Expected result

Page views for the listed public routes appear in the Vercel dashboard without query strings; none from private routes, signed-in sessions or review deployments.

### Evidence destination

Private receipt `d29/a097-…` (activation) and `d29/a096-…` (measurement audit): deployed SHA, env set yes/no, rebuild yes/no, dashboard counts by path. Coordinator updates both register entries. Both stay **Partial** until a real traffic window has been reviewed; A103 needs this before its search/traffic/conversion review means anything.

---

## 10. Kit acceptance (optional newsletter signup)

**Register:** "Integrate optional newsletter signup with a reviewed Kit or equivalent provider setup." `evidence20261113`: "#125 added the optional Kit form with its flag off by default. Live verification is open." (The register ID was not printed in the grep; it sits next to A097–A098. **[UNVERIFIED]** — look it up before filing evidence.)

**Candidate SHA:** `fe1f2b14`. **[HELD]**: a submission creates a record in a third-party service.

### What the code does [READ FROM CODE] (`src/components/marketing/newsletter-signup.tsx`)

- Renders only when server env `CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED=1` **and** `CONSTRUCTA_REVIEW_ONLY` is not `1` **and** `VERCEL_ENV` is not `preview`. Otherwise it renders nothing.
- It is a plain HTML form posting `email_address` straight to `app.convertkit.com/forms/<form id>/subscriptions` (the legacy ConvertKit host for Kit). It is rendered from `src/components/marketing/phase-one.tsx`; which page shows it was not confirmed.
- The component contains **no privacy or consent wording** beyond the label "Email for Constructa updates". Whether consent copy appears elsewhere on the page, and what the Kit form itself sends (double opt-in, confirmation email), are **[UNVERIFIED]**.
- Measurement: `WaitlistSubmitAttempt` forwards nothing while custom events are disabled.

### Steps

1. **[ROB]** Approve enabling the flag on the chosen production deployment and confirm the Kit account/form that the form id points to is Constructa's. **[UNVERIFIED]** — the id is in source but ownership was not checked.
2. **[OPERATOR-ONLY]** In the Kit account, confirm for that form: confirmation (double opt-in) setting, the confirmation email wording, the sender, and the unsubscribe path. Record the settings; do not change them.
3. **[ROB]** Read the page that renders the form. Decide whether the consent/privacy wording next to it is sufficient; raise as a finding if not.
4. **[OPERATOR-ONLY]** Set `CONSTRUCTA_NEWSLETTER_SIGNUP_ENABLED=1` (server env) and redeploy. Record the deployed SHA.
5. **Negative check.** **[ROB]** Confirm the form is absent on a Preview deployment and under review-only mode.
6. **Acceptance.** **[ROB]** Submit **Rob's own** address once. Expected: the browser lands on Kit's response; the confirmation email arrives (if double opt-in); after confirming, the subscriber appears in that form's list in Kit.
7. **Unsubscribe.** **[ROB]** Use the unsubscribe link in the email. Expected: the subscriber shows as unsubscribed in Kit.

### Expected result

Form shown only on the enabled production deployment; one real subscriber created via the form; confirmation and unsubscribe both work.

### Evidence destination

Private receipt `d29/kit-…`: deployed SHA, env set yes/no, Kit form settings (no list data), submission and confirmation timestamps, unsubscribe result. No addresses in the receipt. Coordinator updates the newsletter register entry.

---

## 11. A102 — Social publication

**Register:** "Repurpose approved site content for LinkedIn, Facebook and optional Medium with links back to Constructa." **Partial.** `evidence20261113`: "#122 merged approved social copy into the repository. Publication remains with Rob."

**Candidate SHA:** `fe1f2b14`. **[ROB]** performs publication. **[HELD]**: nothing is published or scheduled by automation.

### What exists [READ FROM CODE]

- Batch 1: `docs/delivery/2026-11-13/kimi-a102-social-drafts.md` (merged, #122) — checklist posts from the two Guides.
- Batch 2: `docs/delivery/2026-11-14/kimi-a102-social-drafts-20261114.md` — four drafts (LinkedIn and Facebook) on the connected journey and the founding cohort. Marked **DRAFT · NOT APPROVED · NOT PUBLISHED**. Whether it is committed on `main` at this SHA was not confirmed (it is present in this checkout). The batch-1 file was not re-read in this pass.
- Batch 2 uses only canonical links: `https://www.constructa.co/`, `/features`, `/pricing`, `/apply`. No UTMs, short links or new paths.
- Facts the posts depend on: the founding cohort "opens 7 December 2026"; the application form "is a preview and cannot accept submissions yet"; "Apply is separate from sign-in. This preview does not take a payment."

### Steps

1. **[ROB]** Open each post and tick the document's own pre-publish checklist. Re-check the two time-sensitive claims against the live `/apply` and `/pricing` pages on the day of posting: the cohort date, and "cannot accept submissions yet" (which will be false the moment applications work). **[UNVERIFIED]** — live site state was not read.
2. **[ROB]** Choose the posts to publish, and not both batches on the same day (the checklist says near-identical content should not run together).
3. **[ROB]** Edit wording as wanted. Keep the phase-one / existing-review-account framing; add no live-AI, payment, testimonial, statistic, price or launch-date claim.
4. **[ROB]** Post manually from the company LinkedIn page / Facebook page. Optional Medium is not drafted.
5. **[ROB]** Open each live post and click each link. Expected: lands on the exact canonical page with no extra parameters.
6. **Measurement note.** With analytics activation (item 9), social visits appear as page views at best; UTMs are stripped and not recorded, so no per-post attribution is possible.

### Expected result

Approved posts live; links resolve to the canonical pages; claims match the live site on the day.

### Evidence destination

Private receipt `d29/a102-…`: post URLs, timestamps, which draft each was, who approved the wording. The coordinator marks A102 only with this; it remains Partial otherwise.

---

## 12. A103 — Contractor-content pilot publication

**Register:** "Establish a small useful contractor-content pilot and review search/traffic/conversion results." Status **Not started.**

**Candidate SHA:** `fe1f2b14`. **[HELD]**: publication, merge and deploy are all outside this document.

### What exists [READ FROM CODE]

- A draft guide, `docs/delivery/2026-11-14/a103-guide-draft-exclusions-clarifications.md`, proposed slug `exclusions-and-clarifications`. **DRAFT · NOT APPROVED · NOT PUBLISHED.** It is **not** in `src/lib/marketing-guides.ts` (the two live Guides there are `review-brief-and-price` and `programme-and-proposal-before-sharing`, per the draft's own de-duplication table). The draft's text claims only the cited product lines.
- Its pilot gate: if published, it is `noindex` or not linked from navigation (the draft cites a CTO direction at 15:25 on 13 Nov 2026). How noindex is implemented for `/guides/*` was **not checked**. **[UNVERIFIED]**
- Publishing therefore requires a **code change** to add the Guide, which goes through the normal build, review, merge (Rob's explicit yes for the exact tested candidate) and deploy path.

### Steps

1. **[ROB]** Human fact and tone pass on the draft (UK small-contractor accuracy, no unverifiable claims). Tick the draft's checklist. Decide whether it goes ahead.
2. **[OPERATOR-ONLY]** Package it as a code change adding the Guide, for review on its own branch. Verify the slug does not collide with an existing route.
3. **[OPERATOR-ONLY]** Run the original build, TypeScript and Supabase target guards on that exact candidate, per `AGENTS.md`. These are new checks on a new SHA, not a rerun of this one.
4. **[ROB]** Review and give an explicit yes for that exact tested candidate before any merge. **[HELD]**
5. **[OPERATOR-ONLY]** Deploy through the normal route.
6. **Post-publish.** **[ROB]** Open the live Guide. Expected: attribution reads "Constructa" / "AI-assisted draft guidance", the phase-one preview framing is present, the page is not linked from navigation and carries `noindex` (view source / response headers). **[UNVERIFIED]**
7. **Review period.** After a defined window agreed in the inbox, review search, traffic and conversion for the Guide. This needs item 9 live; without it only Vercel page views exist, and conversion cannot be attributed.

### Expected result

One original Guide live per the pilot gate, with the review criteria and window agreed.

### Evidence destination

Private receipt `d29/a103-…`: PR/branch and exact tested SHA, Rob's yes, deployed SHA, noindex check, first review of metrics. A103 moves from Not started only once the Guide is live; "established" and "reviewed" are separate tests.

---

## 13. Open questions for Rob

2. Which environment is the first target for each live change (A074, A038, A023, analytics, Kit): disposable/QA, or production?
4. A092: is the designated local session the `e2e/local-phase1` harness or a hand session? Which browser?
5. A038: is AI enhancement meant to be activated at all (it is hard-off in source)?
6. A023: who owns the final legal wording, and is it already in the terms page?
7. Kit: confirm the form id belongs to Constructa's Kit account and that its consent wording is acceptable.

## 14. Limits of this document

- Written from the repository and the `AGENTS.md` / `DEVELOPMENT.md` / register text only. It was not tested against a running app, a deployment, a database, or any vendor console.
- The Constructa inbox, Gmail, private records and git metadata could not be read; every dependency on them is tagged [UNVERIFIED] or [HELD] rather than assumed.
- Vendor UI paths (Supabase tokens, Perplexity, Kit, Vercel dashboard) were not checked against current vendor documentation.
- The older root `CLAUDE.md` is stale (dated 6 April 2026) and conflicts with `AGENTS.md` on git identity and auto-deploy; it was used only to identify that a consumer exists for the Supabase token. `AGENTS.md` governs.
- No builds, installs, settings changes, pushes, deployments, publication, live SQL or real signup were performed in writing this document. The document records operator steps and evidence destinations.

## Document control

| Field | Value |
| --- | --- |
| Task | D29 — Rob walkthrough runbook |
| File | `docs/delivery/2026-11-15/d29-rob-walkthrough-runbook.md` |
| Created | 2026-11-15 |
| Candidate | `fe1f2b14` (verified source baseline; see 0.1) |
| Items | A023, A086, A092, A096, A097 (analytics activation), A102, A103, A105, A106, A074, A089, A038, Kit |
| Actions taken | Draft prepared for review. Operator checks are pending. |
