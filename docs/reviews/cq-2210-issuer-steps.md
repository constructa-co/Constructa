PASS — `docs/reviews/cq-2210-issuer-steps.md` created (public-safe numbered checklist for Rob; left uncommitted for runner; **not** issuer revocation evidence; A105 and A106 stay **Partial** until Rob confirms at each provider).

# CQ-2210 — Issuer steps for Rob (Perplexity + Supabase)

Plain-English checklist only. No secrets in this file, in chat, in the inbox, in Git, or on the CLI. Nothing here runs builds, deploys, SQL, or settings changes for you.

**Context (public-safe, already recorded):** Constructa’s delivery sheet ([`docs/delivery/2026-10-28/handoff.md`](../delivery/2026-10-28/handoff.md) §8) recommends **issuer-led** containment of (1) an exposed **Perplexity-related** credential tied to agent/MCP proxy use (A105), and (2) an exposed **Supabase personal access token (PAT)** from history (A106). Rob confirmed **21:44** that the **old Perplexity credential is still not revoked** at the issuer. This document gives steps; **you** must complete them in the provider accounts.

---

## Before you start — two different problems

| Issue | What it is | What it is **not** |
|--------|------------|---------------------|
| **A105 — Perplexity** | The exposed **Perplexity-related credential**, whose issuer entry and any separate proxy/agent access must be identified | Not fixed by deleting an unrelated key or removing the literal string from the repo. Sonar is a Perplexity API product, not a different issuer |
| **A106 — Supabase PAT** | A **personal access token** on your **Supabase account** (CLI, dashboard API, automation) | **Not** the project **anon** key, **service_role** key, or JWT secret used by the live app. **Do not** “rotate everything” in the project API settings unless a separate review says those keys were exposed |

**Consumers:** Anything that ever copied the leaked value may still work until **you** revoke the matching issuer entry. List **external** users yourself: other machines, CI, MCP/Codex/Claude/Cursor configs, old laptops, shared scripts, backup branches, forks, or caches. **Absence from this repo does not mean nothing else still uses the old credential.**

---

## Part A — Perplexity (A105)

### Understand issuer key vs proxy grant

1. **Issuer API key** — Created in Perplexity’s account/API area. Whoever holds it can call Perplexity’s API within that key’s limits and billing.
2. **Separate proxy or agent grant** — Some setups use an **additional** internal proxy, MCP bridge, or org-specific access path. **Revoking only one API key might not remove access** that was granted or configured elsewhere. If you are unsure whether proxy access is independent, treat both as in scope and ask Perplexity support which controls apply to your account.

### Steps (human at Perplexity)

1. Sign in to the **Perplexity account that originally issued** the exposed key (billing and account recovery are **your** steps only; do not paste account details into Constructa chat).
2. Open [Perplexity API Keys](https://console.perplexity.ai/project/keys) in the correct existing project. This is the destination linked by [Perplexity's key-management guide](https://docs.perplexity.ai/docs/admin/api-key-management), verified 31 October 2026. If this is a proxy-issued credential rather than a Perplexity API key, use that issuer's private revocation route instead; do not assume deleting an unrelated API key invalidates the proxy.
3. **Identify the old entry without pasting values:** use **creation date**, **label/name you gave it**, **last used** (if shown), and your memory of which key was committed or shared. If **two entries look alike**, **stop** — do not revoke until you know which one still powers an approved tool.
4. **Revoke or delete** only the entry that matches the **exposed** credential (not a newer replacement you already use elsewhere).
5. **Record confirmation (non-secret only):** date/time (UTC or your timezone), provider name, entry **label** (not the secret), approximate scope (e.g. “API key for MCP”), and “revoked” or “not found / already inactive”. Store that note in your **private** ops record — not in Git.
6. **Proxy / MCP follow-up:** If you use Perplexity through MCP or an agent proxy, open **that product’s** settings (locally on each machine — **never** commit) and remove or replace the old value with a **new** key only where you still need access. Update **each** consumer you listed in “Before you start”.
7. **If self-service revoke is unclear** (register notes mention internal proxy paths): contact Perplexity support, say an API key was exposed in a public repository, and ask them to **invalidate that key and any linked proxy access** — again **without** sending the secret in email if their portal offers a “report compromised key” flow.

**Do not** use “list my keys” or API calls as **proof** of revocation for A105. **Do not** probe the old secret to see if it still works.

---

## Part B — Supabase personal access token (A106)

### Understand PAT vs database keys

1. **Personal access token (PAT)** — Tied to **your Supabase login**. It can authorize the CLI, Management API, and account-level actions (projects, tokens, org settings — depending on what was granted when the token was created). Revoking the **old PAT** stops **that** automation identity; it does **not** by itself rotate app runtime keys.
2. **Project API keys (anon / service_role)** — Used by the Constructa app and server code. Only change these if **those specific keys** were exposed or policy requires it. **This checklist does not tell you to rotate anon or service_role** for the historical PAT leak alone.

### Steps (human at Supabase)

1. Sign in to **supabase.com** with the **same account** that would have created the leaked PAT (often the Constructa project owner).
2. Open [Supabase account access tokens](https://supabase.com/dashboard/account/tokens), the destination linked by [Supabase's personal-access-token guide](https://supabase.com/docs/guides/platform/personal-access-tokens), verified 31 October 2026. This is the account-token page, not the project's runtime API-key page.
3. **Identify the old token without pasting values:** use **name**, **created date**, **expiry**, and **scopes** shown in the list. Match the token era to when it was added to git or shared with agents. If you cannot tell which row is the leaked one, **stop** and revoke only after you are sure — or revoke **all** legacy tokens you no longer need, one at a time, noting each label.
4. **Revoke** the correct old token (or delete it, per UI).
5. **Record confirmation (non-secret only):** date/time, token **name/label**, scopes as shown in the UI (e.g. “all projects” vs single project — describe in words, no secret strings).
6. **Replace only what still needs CLI/Management API access:** create a **new** PAT with the **smallest scope** that still works (single project, read-only if possible). Install it **only** in private stores: password manager, local CLI config, or host secret store — **not** in the repo, `.mcp.json`, chat, or inbox.
7. **Review consumers separately:** On each machine or service that ran `supabase login`, CI, or remote agents, update or remove stored credentials. A revoked PAT does not automatically update copies on other computers.
8. **Optional prudence (not mandatory for PAT-only exposure):** In the Supabase **project** dashboard, skim **API** settings only to confirm you did **not** accidentally paste PAT into a place meant for anon/service keys. Do **not** reset JWT secret or roll service_role unless you have separate evidence those were leaked.

**Do not** treat “I don’t see the old token in the list” as complete containment without a dated note. **Do not** run auth probes with the old token.

---

## Part C — After issuer actions (still Partial until you confirm)

1. **A105** moves off **Partial** only when **you** have a private note that the correct Perplexity issuer entry (and any separate proxy path you identified) is revoked or confirmed inactive — not when this markdown file exists.
2. **A106** moves off **Partial** only when **you** have revoked the correct Supabase PAT and updated approved consumers with least privilege — not when agents read a token list.
3. **Git history:** Revocation does not erase old commits. Private-repo and history decisions stay under **A108**; do not force-push or rewrite history as a substitute for issuer revoke.
4. **Constructa runners:** They must **not** paste new keys into commits, env files in Git, or MCP templates. Replacement stays **human + private settings**.

---

## Quick numbered checklist (print-friendly)

1. List every place that might still use the old Perplexity key or Supabase PAT (machines, agents, CI, forks — not “repo only”).
2. Perplexity: sign in → API key area → identify old key by **label/date** (no pasting secrets) → revoke → note date/label/scope privately.
3. Perplexity: check MCP/proxy/agent configs on each consumer; remove old value; add **new** key only where still approved.
4. If Perplexity proxy access might be separate from the API key, confirm with Perplexity which control invalidates it.
5. Supabase: sign in → personal/access token area → identify old PAT by **name/date/scopes** → revoke → note privately.
6. Supabase: issue **new** PAT with minimum scope; store only in private settings; update CLI/agents that still need it.
7. **Do not** rotate Constructa **anon/service_role/JWT** keys unless separately justified.
8. Keep A105/A106 **Partial** until steps 2–6 are done and recorded; this file is **guidance only**, not evidence.

---

## References (public-safe)

- [`docs/delivery/2026-10-28/handoff.md`](../delivery/2026-10-28/handoff.md) — §8 issuer-led credential containment recommendation.
- [`docs/backup-snapshots/2026-10-20/walkthrough-action-register.md`](../backup-snapshots/2026-10-20/walkthrough-action-register.md) — A105/A106 scope and “Partial” criteria (metadata only; verification JSON paths are private ops).
