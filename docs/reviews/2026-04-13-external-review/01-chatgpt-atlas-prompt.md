# ChatGPT (via Atlas browser) — Live App Walkthrough Prompt

**Paste this into ChatGPT Atlas. Atlas can drive the browser, so it should navigate the live app and test workflows end-to-end.**

---

## Your role

You are an independent QA reviewer auditing a live SaaS product called **Constructa** (https://constructa-nu.vercel.app) — an all-in-one platform for UK SME construction contractors. I need you to act as a **first-time beta contractor** using the product and report everything that feels wrong, confusing, broken, or unpolished.

Before you start, read this comprehensive project report to understand what has been built and what is deliberately out of scope:
👉 https://github.com/constructa-co/Constructa/blob/main/docs/reviews/2026-04-13-external-review/00-project-report.md

## The credentials

The product owner will share the login credentials with you separately. Use them to sign in at https://constructa-nu.vercel.app/login.

**Do not click "Send Proposal via Email" during testing — the live Resend integration will send real emails. Use "Copy Proposal Link" to test that flow instead.**

## What to do (in order)

### Stage 1: First impressions
1. Navigate to the marketing landing page at https://constructa-nu.vercel.app (without logging in). Describe what you see, whether the value proposition is clear within 5 seconds, and what you would click if you were a busy SME contractor.
2. Click "Sign in" and describe the login page.

### Stage 2: Home dashboard
1. After login, you should land on `/dashboard/home` (the ops dashboard, not the CRM kanban). Describe the first-screen experience.
2. Check the KPI strip (Pipeline Value, Active Projects, Certified Outstanding, Retention Held, Pending Variations, CE Exposure, Open RFIs, Win Rate). Does each KPI tell you something useful or is any redundant?
3. Scroll down and note the Active Projects section, Pipeline preview, Financial Snapshot, and Quick Actions panel.

### Stage 3: Pre-construction workflow (use the "22 Birchwood Avenue" project)
Walk through in order: **Brief → Estimating → Drawings → Programme → Contracts → Proposal**. At each step:
- Does the page load in a reasonable time?
- Is the purpose clear within 5 seconds?
- Are the key actions obvious?
- Do you see anything labelled wrong or inconsistent with UK construction terminology?
- Try clicking the "AI Assistant" buttons where they exist — do the AI responses feel useful for a real contractor?

### Stage 4: Live project management (still on 22 Birchwood)
Walk through: **Overview → Billing → Variations → Change Management → Job P&L → Programme (live) → Communications → Contract Admin**. Key checks:
- **Overview page:** the header should say "At Risk" with a red badge and a banner saying "Forecast loss of £146" (this is the Sprint 58 honest RAG — it's the correct behaviour because this project is forecast to lose money). Confirm this is visible and makes sense.
- **Billing page:** the Revised Contract Sum should be exactly **£1,753.29**. Any other number is a bug.
- **Contract Admin:** click through the Setup Contract form and pick NEC4 ECC. Then explore the 6 tabs (Dashboard, Obligations, Events, Communications, Claims, Delay Analysis). Test "Raise Event" on a Compensation Event (NEC4 cl. 61.3 has an 8-week hard time bar — this is the career-saver feature). Confirm the time bar date auto-calculates to `date_aware + 56 days`. Test "Draft Notice" and check the AI-drafted notice references cl. 61.3 and uses NEC4 terminology correctly.
- **Delay Analysis tab:** run all 4 SCL methodologies (As-Planned vs As-Built, Time Impact, Collapsed As-Built, Windows). Generate AI narrative and check if it reads like a real claims consultant would write it.

### Stage 5: Close-out workflow
1. **Final Account** — the Adjusted Contract Sum should be **£1,753.29** (not £1,593.90 — that was a bug fixed earlier today).
2. **Handover Documents** — 16 items should auto-seed on first view.
3. **Lessons Learned** — test the AI narrative.

### Stage 6: Cross-project views
1. **Management Accounts** — all 6 tabs (Overview, P&L by Project, Cash Flow, WIP Schedule, Key Ratios, Export). The "Active Projects" KPI should show **1** (consistent with home dashboard).
2. **CIS Compliance** — 4 tabs (Overview, Subcontractors, Payments, Monthly Returns). This is UK HMRC compliance — any errors here are serious.
3. **Business Intelligence** — does it make sense for a contractor with only 1 active project, or does it need minimum dataset messaging?
4. **Accounting** — 4 tabs (Bank Reconciliation, Company P&L, VAT Periods, Overheads). Check Bank Reconciliation flow.
5. **Reports & Photos** — does the Project Control PDF generate correctly?

### Stage 7: Resource management
1. **Resource Portfolio** — 3 tabs (Portfolio Timeline, Manage Allocations, Demand vs Supply).
2. **Labour Rates** — staff resource catalogue.
3. **Plant Rates** — plant resource catalogue.
4. **Material Rates** — procurement basket flow.

### Stage 8: Settings
1. **Profile** — company profile, MD message, PDF theme selector, benchmark consent checkbox.
2. **Case Studies** — CRUD with AI enhance.
3. **Integrations** — Xero (will show "Not connected" — that's correct, env vars deferred).
4. **API Keys** — Market Intelligence API key management.

### Stage 9: Quick Quote path
Go to `/dashboard/projects/quick-quote`. Pick a template (e.g. "Kitchen Extension"). Fill in the form. See if you can go from click to branded PDF in under 5 minutes (the Sprint 58 target).

### Stage 10: Mobile / PWA experience
Resize your browser window to phone width (375×812) and navigate to `/dashboard/mobile`. Check:
- Does the on-site hub render correctly at phone width?
- Is there a visible FAB button for quick-log cost?
- Does the install banner appear?
- Does the camera-capture attribute work on receipt upload (check markup, you won't have a phone camera in Atlas)?

### Stage 11: Onboarding experience
This is harder to test live because the demo account has projects — but look for the **3-step welcome tour** that should appear on the home dashboard when a user has zero projects. Its first-step cards reveal the product's 3-pillar pitch (Welcome → Estimate/Propose/Win → Manage/Bill/Close).

## What to report

Please return findings in this exact structure:

```markdown
# Constructa — ChatGPT Atlas Review (13 April 2026)

## Overall impression
[2-3 sentences]

## P0 (launch blockers)
1. [Bug, steps, expected, actual, suspected area]

## P1 (must-fix before beta)
1. ...

## P2 (polish)
1. ...

## P3 (nice-to-have)
1. ...

## UK construction domain observations
[Anything where the terminology, clause refs, CIS math, retention handling etc. isn't right for a UK contractor]

## Top 3 "if I had to pick one improvement before beta"
1. ...
2. ...
3. ...
```

## Important rules

- **Do not send real proposal emails.** Use "Copy Proposal Link" instead of "Send Proposal via Email".
- **Ignore test data issues** (see §5 of the project report). Don't report garbled project names like `l;'` — they'll be cleaned up.
- **Ignore deliberately deferred items** (LemonSqueezy billing, Xero connection, Playwright tests).
- **Be brutally honest.** The goal is to find what's wrong, not to validate.
- **Think like a contractor, not a developer.** If something is technically correct but a busy contractor would bounce off it, call that out.
- **Brief over exhaustive.** 15–20 specific actionable findings beats 100 generic ones.
