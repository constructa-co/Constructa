# CON-009 — UK privacy notice (draft for review)

**Status:** Draft for Rob's review. Not published. Not legal advice. Not a compliance certification.
**Date of this draft:** 15 November 2026
**Prepared for:** Robert ("Rob") Smith, Constructa
**Replaces:** The incomplete draft at `src/app/privacy-policy/page.tsx` (which itself says it "does not yet explain who is responsible for your information, the legal basis…, who it is shared with, where it is stored, how long it is kept or how it is protected").
**Scope of this document:** A complete UK GDPR / Data Protection Act 2018 (DPA 2018) privacy notice covering what the product and marketing site actually do today, based on the code and docs at HEAD `33d8fd3f`. Anything the repo cannot confirm is flagged inline.

**Reading the flags:**

- `[UNVERIFIED — Rob]` — a company fact I could not confirm from the repo. Do not publish until confirmed.
- `[DECISION — Rob]` — a supplier, transfer or retention choice only Rob can make. Do not publish until decided.
- Sources for product behaviour cited inline (file paths at HEAD).

**Primary UK authority cited:** Information Commissioner's Office (ICO) — <https://ico.org.uk/>. Relevant ICO guidance used: [Privacy notices guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/privacy-notices/), [UK GDPR guidance and resources hub](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/), [Online tracking guidance (PECR/cookies)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/online-tracking/), [ICO registration self-assessment and fee](https://ico.org.uk/for-organisations/fee/), [Make a complaint](https://ico.org.uk/make-a-complaint/). Law: UK GDPR (retained EU law version post-Brexit) and DPA 2018. Marketing rules: PECR 2003.

> **Draft label to keep on any published version until legally reviewed:** "Draft, not yet legally approved" (the current page already carries this; keep it until a solicitor or equivalent review signs off, per the walkthrough action register entry A024 which warns that "merely adding UK GDPR wording is insufficient").

---

## 1. Who is responsible for your information (controller)

Constructa is the controller of the personal information described in this notice.

- **Trading name:** Constructa
- **Legal entity name:** `[UNVERIFIED — Rob]` (e.g. "X Ltd" or sole trader "Robert Smith trading as Constructa"). UK GDPR Art. 13(1)(a) requires the controller's identity, so this must be confirmed before publication.
- **Registered/office address:** `[UNVERIFIED — Rob]` (Art. 13(1)(a)).
- **Contact for privacy questions:** hello@constructa.co (already used on the current draft page).
- **ICO registration number:** `[UNVERIFIED — Rob]` Most UK organisations that process personal data must pay the ICO data protection fee — use the ICO's self-assessment at <https://ico.org.uk/for-organisations/fee/> to confirm whether Constructa must register. If required and not yet paid, that is an enforcement risk independent of this notice.

## 2. What information we hold and why (purposes, lawful bases)

UK GDPR Art. 13(1)(c) and 13(2) require a purpose and a lawful basis for each use. The table maps what the product demonstrably does today (from code at HEAD) to a proposed basis. Art. 6(1) bases used: contract, legitimate interests, consent, legal obligation.

| # | What we collect | Where it comes from | Why we use it | Lawful basis | Product evidence at HEAD |
|---|---|---|---|---|---|
| 1 | Account identity: name, email, password (hash), phone if supplied | You, at sign-up | Create and secure your account; provide the platform | Contract (Art. 6(1)(b)) | Supabase Auth (`README.md:23`) |
| 2 | Company profile: company name, contact emails/phones, trade details, case studies, photos you upload | You | Display on your proposals and in the app | Contract; legitimate interests (running your business documents) | `src/app/dashboard/settings/*`, proposal document view |
| 3 | Project data: client names, site addresses, estimates, prices, programme, cost entries, receipts/documents you upload | You | Provide estimating, proposals, P&L, programme and document features | Contract (6(1)(b)) | `src/app/dashboard/projects/**`, Supabase Storage `receipts` bucket |
| 4 | Financial/tax data you enter: CIS details, VAT figures, salary/pricing information | You | CIS and financial features you choose to use | Contract; legal obligation where applicable (CIS reporting, if you use it) | `src/app/dashboard/cis/cis-client.tsx` |
| 5 | Client contact details (name, email, phone) entered to send a proposal | You | Email the proposal link to that client at your instruction | Contract; legitimate interests (the client relationship you asked us to serve) | `src/app/dashboard/projects/proposal/actions.ts` (`sendProposalEmail`) |
| 6 | Platform terms acceptance record (revision id, timestamp) | Recorded automatically at sign-up | Evidence of which terms version you accepted | Legal obligation / legitimate interests (accounting for terms) | `src/lib/platform-terms-acceptance.ts`, migration `20261024122500_platform_terms_acceptance.sql` |
| 7 | Newsletter email address | You, via the marketing signup form | Send the updates list you asked to join | Consent (Art. 6(1)(a)) | `src/components/marketing/newsletter-signup.tsx`; posts to Kit/ConvertKit form 7919715 (`docs/marketing/public-measurement-spec.md`) |
| 8 | Page-view analytics: page path, referrer, country, device, browser — signed-out visitors only, public marketing pages only | Collected automatically when enabled | Understand public site traffic | Consent or legitimate interests — `[DECISION — Rob]`, see §6 | Vercel Web Analytics, default-off, cookieless, query strings stripped (`docs/marketing/public-measurement-spec.md`) |
| 9 | Content you submit to AI-assisted features (briefs, drawings descriptions, planning prompts) | You | Generate the suggestions you asked for | Contract; legitimate interests | OpenAI gpt-4o-mini via `src/lib/ai.ts` (`README.md:22`) |
| 10 | Correspondence you send us (support/privacy requests) | You | Respond to you; keep a record | Contract; legitimate interests | hello@constructa.co |

**Special category data:** we do not ask for it. Do not enter health or other special category data about yourself or your clients into the platform — Art. 9 conditions would then need to be assessed.

**Future benchmarking / cross-company insights:** recorded in Robert's walkthrough feedback (18 Oct 2026) as a *desired future direction only*, explicitly "not current functionality or permission to activate collection/sharing/providers." It must not be described in this notice until it exists, and when it does it needs its own transparency, basis and safeguards assessment. Do not bundle it into a blanket consent.

## 3. Who we share it with (recipients / processors)

UK GDPR Art. 13(1)(e) and Art. 28 require processors to be identified (or categories) and contracted. Proposed disclosure, each flagged with what still needs confirming:

| Recipient | What they process | Where | Art. 28 contract in place? | Status |
|---|---|---|---|---|
| Supabase (PostgreSQL, Auth, Storage) | All account, project and file data | `[UNVERIFIED — Rob]` hosting region (project region setting; if US, §4 transfer safeguards apply) | `[DECISION — Rob]` — confirm Data Processing Addendum on the Supabase account | Confirmed as supplier (`README.md:21`) |
| Vercel | Site hosting; page-view analytics when enabled | US (Vercel, Inc.) | `[DECISION — Rob]` — confirm Vercel DPA | Confirmed as supplier (`README.md:24`) |
| Kit (ConvertKit) | Newsletter email addresses | `[UNVERIFIED — Rob]` (Kit LLC, US) | `[DECISION — Rob]` | Confirmed; form 7919715 posts directly from the browser |
| OpenAI | Prompts/content you submit to AI features | US | `[DECISION — Rob]` — confirm API data-use terms (zero-retention/API terms) | Confirmed as supplier (`README.md:22`) |
| Proposal email delivery provider | Client name/email, proposal URL | `[UNVERIFIED — Rob]` — the actual provider behind `sendProposalEmail` is not named in the repo; Rob must confirm who sends proposal emails and where they are hosted | `[DECISION — Rob]` | Gap |
| RICS | Nothing — named only as adjudication body inside proposal contract terms | n/a | n/a | No data sharing |

**We do not sell personal data. We do not share it for third-party marketing.** The only party who decides what goes into a proposal is the contractor — Constructa does not disclose your client data to anyone except the processors above acting on your instructions.

## 4. International transfers

Supabase, Vercel, Kit and OpenAI are US-based companies. UK GDPR Chapter 5 requires either adequacy regulations (the UK's adequacy decisions for the US currently rest on the **UK-US Data Bridge**, extended to covered US organisations under the EU-US Data Privacy Framework) or an **IDTA / UK addendum to the EU SCCs** for anything not covered.

`[DECISION — Rob]` For each supplier: confirm (a) which UK transfer mechanism applies, (b) that the supplier's certification/SCCs are current, and (c) record this in a transfer register. If the Supabase project region is US or EU-with-US-processing, this must be resolved before publishing a notice that claims transfers are safeguarded.

## 5. How long we keep it (retention)

The current published notice admits retention is unexplained — this section is the fix, but the numbers are `[DECISION — Rob]`; the proposals below are starting points, not decisions:

| Data | Proposed retention | Notes |
|---|---|---|
| Account data | Life of account + 30 days after deletion request | |
| Project/estimate/proposal data | Life of account, or export then delete on request | Contractors may need longer for tax records — their own records duty, not necessarily Constructa's |
| Published proposal snapshots | Life of account (they are immutable business records of the contractor) | |
| Receipts/files uploaded | Life of account | |
| Newsletter emails | Until unsubscribed + suppression list indefinitely | Suppression keeps consent withdrawal meaningful |
| Platform terms acceptance records | Life of account + limitation period (suggested 6 years) | Evidential value |
| Analytics page views | Provider-side default `[DECISION — Rob]` — check Vercel retention setting | |
| Support/privacy correspondence | 24 months | |
| Backups | Roll off within backup cycle (suggest ≤ 30 days) after deletion | |

Publish only the rows Rob confirms. Under UK GDPR Art. 5(1)(e), retention must be justified — "indefinitely" is not defensible.

## 6. Analytics and cookies (PECR)

Per `docs/marketing/public-measurement-spec.md` at HEAD:

- **No cookies are set** by Constructa's own code for measurement; custom events are disabled; Vercel Web Analytics is cookieless and counts only signed-out visitors on named public marketing routes.
- Query strings, fragments and credentials are stripped before page views leave the browser; Vercel still records referrer, country, device and browser itself.
- Analytics is **default-off** (nothing mounts unless `NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS=1` at build time) and is not rendered in protected review.

`[DECISION — Rob]` Even cookieless analytics can require consent under PECR/ICO online tracking guidance depending on how it is deployed: decide whether to rely on the "strictly necessary"/legitimate-interests analysis or to gate analytics behind a consent choice, and describe the actual deployed state in this notice. The notice must match the deployment at all times — do not copy this paragraph verbatim if the flag gets switched on.

## 7. Your rights

Under UK GDPR you can: **access** a copy of your information; **correct** it; **erase** it; **restrict** or **object to** processing; **port** it to another service; and not be subject to **solely automated decisions** with legal effect. Constructa does not make solely automated decisions about you.

To exercise any right, email **hello@constructa.co**. We respond within **one month** (extendable by two for complex requests, which we would tell you about). There is no fee unless a request is manifestly unfounded or excessive.

You also have the right to **withdraw consent** (newsletter, or any consent-based processing) at any time without affecting the lawfulness of processing before withdrawal — newsletter emails carry an unsubscribe link.

## 8. Complaints

If you are unhappy with how we handle your information, contact us first at hello@constructa.co. You can then complain to the UK supervisory authority:

**Information Commissioner's Office** — <https://ico.org.uk/make-a-complaint/> — Helpline 0303 123 1113.

## 9. Security

Describe only what is true. Confirmed from the repo: row-level security on all database tables (VISION.md:31), server-side terms acceptance validation (`src/lib/platform-terms.ts`), immutable proposal snapshots with content fingerprints, secret scanning in CI (`.github/workflows/secret-scan.yml`), TLS via hosted platform defaults.

`[UNVERIFIED — Rob]` — before publishing, confirm and then state: encryption at rest (Supabase setting), MFA on the Supabase/Vercel/ConvertKit/OpenAI accounts, access controls (who besides Rob can read production data), and breach-response process. Do not promise "bank-grade security" or absolute safety — the Grok 18 Oct review specifically flagged "unsupported absolute sharing/security wording" in prior copy.

## 10. Children

The platform is a business tool for UK construction contractors. It is not directed at children and we do not knowingly collect children's data. If you believe a child has given us data, contact hello@constructa.co and we will delete it.

## 11. Changes to this notice

We will post changes on this page with an updated date, and where a change affects you directly we will tell you in the app or by email. `[DECISION — Rob]` — decide and state the notice-versioning approach (the platform terms system already tracks document revisions technically via `platform-tos-2026-03`; decide whether privacy notices get the same dated treatment).

**Last updated:** [date] · Previous version: March 2026 (incomplete draft).

---

## Gaps and decisions register (summary for Rob)

| # | Item | Type | Blocking publication? |
|---|---|---|---|
| G1 | Legal entity name, registered address, ICO registration status | UNVERIFIED | Yes — Art. 13(1)(a) |
| G2 | Art. 28 DPAs + UK transfer mechanism for Supabase, Vercel, Kit, OpenAI | DECISION | Yes if notice claims safeguards |
| G3 | Identity/location of the proposal email delivery provider | UNVERIFIED + DECISION | Yes |
| G4 | Retention schedule numbers | DECISION | Yes |
| G5 | Analytics lawful basis (consent vs legitimate interests) matching actual deployment | DECISION | Yes |
| G6 | Security facts to state (encryption at rest, MFA, access control, breach process) | UNVERIFIED | Yes |
| G7 | Privacy notice versioning approach | DECISION | No |
| G8 | Legal review before removing the "draft" banner (per A024 register entry, P1-Jan2027 workstream) | DECISION | Yes for "final" status |
