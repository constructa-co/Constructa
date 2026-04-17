# Gemini (via Antigravity) — Live App Walkthrough + Agentic Test Prompt

**Paste this into Gemini/Antigravity. Antigravity can run agentic browser sessions, so it should perform a scripted end-to-end test and return findings.**

---

## Your role

You are **Gemini acting as an agentic QA and construction-domain expert**, auditing a live SaaS product called **Constructa** (https://constructa-nu.vercel.app) — an all-in-one platform for UK SME construction contractors.

You complement ChatGPT Atlas (which is doing the "first-time contractor" UX review in parallel). Your focus is different: **agentic scripted walkthroughs + construction-domain accuracy + data correctness across views**.

Start by reading the comprehensive project report to understand scope:
👉 https://github.com/constructa-co/Constructa/blob/main/docs/reviews/2026-04-13-external-review/00-project-report.md

## Credentials

The product owner will share the login credentials with you separately. Login at https://constructa-nu.vercel.app/login.

**Do not click "Send Proposal via Email" — live Resend will send real emails.**

## Focus areas (where Gemini/Antigravity adds the most value)

### 1. Data correctness across views (this is the most important check)

The canonical test project is **"22 Birchwood Avenue — Kitchen Extension & Loft Conversion"** (Mr & Mrs Patel). Its contract sum is **£1,753.29** and this must be identical on EVERY page:

- Estimating: `/dashboard/projects/costs?projectId=7b08021a-9ca2-4262-836b-970891608cbe` — Contract Sum top-right
- Proposal editor: `/dashboard/projects/proposal?projectId=...` — Contract Value in Project Summary
- Proposal PDF: click "Generate PDF" — Contract Sum (exc. VAT) line
- Overview: `/dashboard/projects/overview?projectId=...` — "Contract Value" KPI
- Billing: `/dashboard/projects/billing?projectId=...` — "Revised Contract Sum"
- Job P&L: `/dashboard/projects/p-and-l?projectId=...` — "Contract Value"
- Final Account: `/dashboard/projects/final-account?projectId=...` — "Adjusted Contract Sum" and "Original Contract Sum" both rows

**Log the exact number shown on each page.** Any deviation = bug.

### 2. Cross-view KPI consistency

The "Active Projects" count should be identical on:
- Home `/dashboard/home` — "Active Projects" KPI card
- Pipeline `/dashboard` — Active stage count in the kanban
- Management Accounts `/dashboard/management-accounts` — Overview tab "Active Projects"

Log all three values. All should be the same (1 at last check).

### 3. RAG status honesty

On `/dashboard/projects/overview?projectId=...` for 22 Birchwood, the status badge should say **"At Risk"** (red) because the project is forecast to lose £146. If it ever shows "On Track" green when the forecast margin is negative, that's a regression (the Sprint 58 honest RAG was specifically designed to prevent this lie).

### 4. UK construction domain audit

Review these specific areas for domain correctness:

**NEC4 ECC contract form** (the most common UK civils form):
- Open Contract Admin for 22 Birchwood, pick NEC4 ECC, set it up. Then:
  - Obligations seeded should include: Programme for acceptance (cl. 31.1 — 8 weeks after Starting Date), First payment application, Working hours, Insurances.
  - Go to Events tab → Raise Event → Compensation Event. The `time_bar_date` should auto-calculate to **`date_aware + 56 days`** (8 weeks — NEC4 cl. 61.3).
  - Click "Draft Notice" — the AI-drafted notice should:
    - Reference clause 61.3 explicitly
    - Use NEC4 terminology ("Project Manager", "Compensation Event", "Contractor", "Employer") — NOT JCT ("Architect", "Loss & Expense") or FIDIC ("Engineer", "Variation")
    - Mention the 8-week bar
    - Be structured like a contractual notice, not generic prose

**JCT SBC** (most common building form):
- Change contract type to JCT SBC. Events should include: Extension of Time (cl. 2.27.1), Loss & Expense (cl. 4.20), Variation (cl. 3.10).
- Raise an EoT event. "Draft Notice" should reference cl. 2.27.1 and the "forthwith" notice requirement (Walter Lilly v Mackay).

**FIDIC Red Book 1999:**
- Change contract type to FIDIC Red 1999. Raise a Claim event. "Draft Notice" should reference cl. 20.1 and the hard 28-day time bar (reference Obrascon v AG of Gibraltar).

**FIDIC Red Book 2017:**
- Change to FIDIC Red 2017. Raise a Claim event. "Draft Notice" should reference **cl. 20.2.1** (the 2017 renumbering), not cl. 20.1.

**SCL Delay Analysis Protocol** (tab 6 in Contract Admin):
- Run all 4 methodologies for 22 Birchwood (you'll need to add some test as-built dates on the programme phases first — use the Programme page).
- The AI narrative for each methodology should:
  - Reference SCL Delay and Disruption Protocol 2nd Edition (February 2017)
  - Correctly identify the methodology used
  - Use UK claims language (Extension of Time, Prolongation, Disruption — not US English)
  - Reference "contemporaneous records" and "as-built programme"

**CIS Compliance** (`/dashboard/cis`):
- The standard deduction rate is **20%** for verified subcontractors, **30%** for unverified, **0%** for gross-status.
- When logging a payment, the split should be: Gross = Labour + Materials; CIS deduction = `labour_amount × rate`; materials are excluded from the CIS calc.
- Tax month runs 6th of one month to 5th of the next (confirm on the Monthly Returns tab).

**VAT Periods** (`/dashboard/accounting`):
- Quarterly is the default for UK contractors. MTD VAT requires HMRC period keys in format `24A1` (24=year, A=start month, 1=quarter).

### 5. PWA / mobile experience

Resize Chrome DevTools to an iPhone 14 Pro (393×852). Test:
- Home dashboard: does it render correctly?
- Mobile hub `/dashboard/mobile`: FAB should be visible bottom-right, tapping it should open a slide-up 3-field quick-log form (Amount £, Description, Cost Type).
- Install banner should appear at the bottom.
- Receipt upload on Job P&L LogCostSheet should have `capture="environment"` (check page source for the input element).

### 6. Supervisor portal

From Contract Admin Dashboard tab, click "Invite Supervisor" → enter name + email → "Generate Link" → copy the link → open it in a fresh incognito tab. Check:
- Can you see obligations without logging in?
- Can you click "Acknowledge" on an obligation assigned to supervisor?
- Does the acknowledgment persist?
- Is the role terminology correct for the contract form (Project Manager for NEC, Engineer for FIDIC, Contract Administrator for JCT)?

### 7. Accessibility spot-check

- Test keyboard navigation on the home dashboard — can you tab through all interactive elements in a logical order?
- Does Escape close open dialogs?
- Are form errors announced to screen readers (look at aria-live or toast implementation)?
- Colour contrast on dark mode — any text that's too low contrast to read?

### 8. Error handling

Provoke some errors and check the UX:
- Open `/dashboard/projects/overview?projectId=invalid-uuid` — does it show a friendly error or a white screen?
- Turn off wifi briefly during a cost log save — does the UI recover when wifi comes back?
- Click "Generate PDF" on a proposal with no estimate lines — does the PDF still build, or error gracefully?

## Deliverable

Return a structured Markdown report:

```markdown
# Constructa — Gemini/Antigravity Review (13 April 2026)

## Executive summary
[3 sentences]

## Data correctness audit
| Page | Expected | Actual | Status |
|------|----------|--------|--------|
| Estimate | £1,753.29 | ... | ✅/❌ |
| Proposal Editor | £1,753.29 | ... | ✅/❌ |
| Proposal PDF | £1,753.29 | ... | ✅/❌ |
| Overview | £1,753.29 | ... | ✅/❌ |
| Billing (Revised Contract Sum) | £1,753.29 | ... | ✅/❌ |
| Job P&L | £1,753.29 | ... | ✅/❌ |
| Final Account (Original) | £1,753.29 | ... | ✅/❌ |
| Final Account (Adjusted) | £1,753.29 | ... | ✅/❌ |

## Active Projects KPI consistency
| Page | Count |
|------|-------|
| Home | ... |
| Pipeline | ... |
| Management Accounts | ... |

## RAG status check
[Confirmed At Risk red with £146 loss / or regression noted]

## UK construction domain findings
### NEC4 ECC
1. ...
### JCT SBC
1. ...
### FIDIC Red 1999 / 2017
1. ...
### SCL Delay Protocol
1. ...
### CIS
1. ...
### VAT
1. ...

## PWA / mobile findings
1. ...

## Supervisor portal findings
1. ...

## Accessibility findings
1. ...

## Error handling findings
1. ...

## Bugs (P0/P1/P2/P3)
[Numbered list with steps to reproduce]

## Top 3 strategic improvements
1. ...
2. ...
3. ...
```

## Rules

- Do not send real proposal emails.
- Ignore test data (see §5 of the project report).
- Ignore deliberately deferred items (billing, Xero, Playwright).
- Domain accuracy is your superpower — use it. If any clause reference, time bar, or terminology is wrong for the jurisdiction, flag it.
- Be specific. "Bug on billing page" is useless; "Billing page at `/dashboard/projects/billing?projectId=X` shows `£1,593.90` as Revised Contract Sum instead of `£1,753.29`" is gold.
