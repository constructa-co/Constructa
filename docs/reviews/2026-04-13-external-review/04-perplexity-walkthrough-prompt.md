# Perplexity — Live App + Code Review Prompt

**Paste this into Perplexity. Perplexity can browse the live app AND fetch source code from the public GitHub repo, so it's well-suited to cross-referencing what the app does with what the code says.**

---

## Your role

You are **Perplexity acting as a construction-domain + SaaS product reviewer**. You did an extensive audit of Constructa on 11 April 2026 (archived at `docs/reviews/2026-04-11/perplexity-live-app-review.md` + `perplexity-codebase-analysis.md` + `perplexity-review-report.pdf`). This is your **follow-up review** two days later, after the owner + Claude have shipped:

- 5 prioritised gap-fillers from your previous review
- Sprint 59 complete (Contract Administration Suite + Supervisor Portal + SCL Delay Analysis)
- Light mode fixes
- PDF generator migration
- QA walkthrough + 1 bug found and fixed

Your job: **check whether your previous recommendations were actually addressed, and find what's new and broken**.

Start by reading the comprehensive project report:
👉 https://github.com/constructa-co/Constructa/blob/main/docs/reviews/2026-04-13-external-review/00-project-report.md

And cross-reference with your previous review for continuity:
👉 https://github.com/constructa-co/Constructa/blob/main/docs/reviews/2026-04-11/perplexity-live-app-review.md
👉 https://github.com/constructa-co/Constructa/blob/main/docs/reviews/2026-04-11/perplexity-codebase-analysis.md

## Live app

https://constructa-nu.vercel.app (the owner will share login separately)

**Do not click "Send Proposal via Email" — live Resend sends real emails.**

## Repo

https://github.com/constructa-co/Constructa (public)

## Focus areas

### 1. Regression check from your previous review

Your 11 April review had a 25-item gap analysis. The owner tracked which were done, partial, not done, or deferred. Confirm the following **claimed-done** items are actually done:

| # | Item | Expected evidence |
|---|------|-------------------|
| 1 | Error boundaries on every route group | Visit `/dashboard/projects/overview?projectId=invalid` — friendly error, not white screen |
| 2 | `requireAuth()` on mutating actions | Grep codebase for server actions without `requireAuth` |
| 3 | Honest RAG (forecast margin) | On 22 Birchwood Overview: red "At Risk" badge + "Forecast loss of £146" banner |
| 4 | Unified Active Projects KPI | Home = Pipeline = Management Accounts |
| 5 | Sidebar context sync with URL | Navigate to Variations/Reporting with `?projectId=...` — sidebar widget reflects the active project |
| 6 | Test data removed | (Pending — owner plans to clean this immediately after this review) |
| 7 | Canonical `src/lib/financial.ts` | 35 tests passing; no inline QS formula remaining |
| 8 | Canonical `computeContractSum` used everywhere | £1,753.29 on Estimate, Proposal, Billing, Overview, P&L, Final Account |
| 9 | Zod validation on 8 high-risk actions | Check `src/lib/validation/schemas.ts` exists with 8 schemas |
| 10 | Shared PDF helpers | Check `src/lib/pdf/pdf-theme.ts` + `pdf-money.ts` — with 19 tests |
| 11 | Core domain types | Check `src/types/domain.ts` exists |
| 12 | Quick Quote path | `/dashboard/projects/quick-quote` with 6 templates |
| 13 | Proposal editor autosave | Should show "Autosave on — saves every 1.5s" indicator |
| 14 | Forgot-password flow | `/auth/forgot-password` reachable from login page |
| 15 | Reporting page loads current project | Open Reporting from 22 Birchwood context — should NOT default to "14 Maple Close" |
| 16 | Final Account £–0.00 formatting | Negative zero rendered correctly |
| 17 | Light mode toggle | Toggle works on `/dashboard/resources/staff` and `/dashboard/resources/plant` |

### 2. Sprint 59 review (new since you last saw the product)

**Contract Administration Suite** is the biggest new feature:

- `/dashboard/projects/contract-admin?projectId=...` — setup form for any project without a contract, full 6-tab dashboard once set up
- Supported: NEC3 ECC, NEC4 ECC, JCT SBC, FIDIC Red 1999/2017, FIDIC Yellow 2017, Bespoke
- 6 tabs: Dashboard / Obligations / Events / Communications / Claims / **Delay Analysis**
- Time bar auto-calc: `time_bar_date = date_aware + contractorTimeBarDays`
- AI Notice drafting with clause-specific `aiGuidance` strings (currently populated for NEC4 CE, NEC4 EW, NEC3 CE, JCT SBC Variation, JCT SBC EoT, JCT SBC L&E, FIDIC Red 1999 Claim, FIDIC Red 1999 engineer_instruction + 2017 overrides)
- **Daily email cron** at 07:00 UTC sweeping time bars + obligations and sending digest via Resend (requires `CRON_SECRET` and `NEXT_PUBLIC_APP_URL` env vars — confirmed set)
- **Home dashboard red/amber alert banners** for time bars ≤14 days, overdue obligations, obligations due this week
- **Supervisor portal** — token-based `/supervisor/[token]` public route with read-only obligation view + acknowledge button

**SCL Delay Analysis Protocol** (6th tab in Contract Admin):
- 4 methodologies: As-Planned vs As-Built, Time Impact Analysis, Collapsed As-Built, Windows Analysis
- AI narrative generation using GPT-4o-mini with SCL Protocol 2nd Edition context
- Results stored in `delay_analyses` table

Please review:
- Are the NEC4/JCT/FIDIC clause references correct? (You're the best on legal/construction-domain accuracy.)
- Is the SCL Protocol methodology description accurate?
- Does the AI Notice drafting produce output that a claims consultant would actually use?
- Does the Supervisor portal feel like a usable read-only portal to a contract administrator?

### 3. Your 3 "strategic" concerns from the previous review

Previously you raised:

1. **"The product is trying to do too much. Consider a clearer initial tier separating pre-construction from live project management."**
   - Current status: Quick Quote was shipped as the streamlined path (keeping full wizard for bigger jobs). Is this a sufficient response, or does it still feel like too much on first login?

2. **"The marketing site at constructa.co is two sprints behind the product and undersells what's built."**
   - Current status: Owner has deferred the marketing rewrite until after beta feedback. Do you still think this is the biggest risk to launch?

3. **"PDF generation is a 1,400+ line monolith."**
   - Current status: Decomposed today into 9 section modules + orchestrator. Visit the live app → generate a proposal PDF → check output is still correct and none of the polish regressed.

### 4. What's the ONE thing that will cause the beta to fail?

Based on your 11 April review + this follow-up, what's the single thing you're most worried about for a first-time contractor using the product in anger?

## Deliverable

Return a structured Markdown report:

```markdown
# Constructa — Perplexity Follow-Up Review (13 April 2026)

## Regression check — claimed-done items
| # | Item | Confirmed? | Notes |
|---|------|:-:|-------|
| 1 | Error boundaries | ✅/❌ | ... |
| 2 | requireAuth() on actions | ✅/❌ | ... |
...

## Sprint 59 review
### NEC4 / NEC3 accuracy
1. ...
### JCT SBC accuracy
1. ...
### FIDIC accuracy
1. ...
### SCL Delay Protocol accuracy
1. ...
### Supervisor portal feel
1. ...
### AI notice drafting quality
[Paste a sample AI-drafted notice and grade it 1-5 for: clause accuracy, terminology, structure, usability]

## Strategic concerns — revisited
### 1. Pre-construction vs live project split
[Is Quick Quote a sufficient response?]
### 2. Marketing site gap
[Still the biggest launch risk?]
### 3. PDF decomposition
[Output fidelity after refactor — any regression?]

## New findings (things you didn't see in the 11 April review)
### P0
1. ...
### P1
1. ...
### P2
1. ...

## The ONE thing that will cause beta to fail
[A single paragraph. Be direct.]

## Top 3 actions before inviting real contractors
1. ...
2. ...
3. ...
```

## Rules

- **Use your previous review as a baseline.** This is a follow-up, not a fresh review.
- **Cite file paths and URLs where useful** — you have access to both the live app and the public repo.
- **UK construction domain accuracy is your highest-value contribution.**
- **Be honest about what got better and what didn't.**
- **Do not send real proposal emails. Do not test the `/api/cron/contract-alerts` endpoint** (that would cause real emails to real users once the cron fires tomorrow at 07:00 UTC).
- **Ignore deliberately deferred items** (LemonSqueezy billing, Xero live connection, Playwright E2E suite, marketing site rewrite, QuickBooks/Sage).
