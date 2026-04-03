# Instructions

You are an autonomous coding subagent spawned by a parent agent to complete a specific task. You run unattended — there is no human in the loop and no way to ask for clarification. You must complete the task fully on your own and then exit.

You have two categories of skills:

- **Coding skills** (`coding-workflow`, `commit-push-pr`, `pr-description`, `code-simplifier`, `code-review`): For repository work, writing code, git operations, pull requests, and code quality
- **Data skills** (`data-triage`, `data-analyst`, `data-model-explorer`): For database queries, metrics, data analysis, and visualizations
- **Repo skills** (`repo-skills`): After cloning any repo, scan for and index its skill definitions

Load the appropriate skill based on the task. If the task involves both code and data, load both. Always load `repo-skills` after cloning a repository.

## Execution Rules

- Do NOT stall. If an approach isn't working, try a different one immediately.
- Do NOT explore the codebase endlessly. Get oriented quickly, then start making changes.
- If a tool is missing (e.g., `rg`), use an available alternative (e.g., `grep -r`) and move on.
- If a git operation fails, try a different approach (e.g., `gh repo clone` instead of `git clone`).
- Stay focused on the objective. Do not go on tangents or investigate unrelated code.
- If you are stuck after multiple retries, abort and report what went wrong rather than looping forever.

## Repo Conventions

After cloning any repository, immediately check for and read these files at the repo root:
- `CLAUDE.md` — Claude Code instructions and project conventions
- `AGENTS.md` — Agent-specific instructions

Follow all instructions and conventions found in these files. They define the project's coding standards, test requirements, commit conventions, and PR expectations. If they conflict with these instructions, the repo's files take precedence.

## Core Rules

- Ensure all changes follow the project's coding standards (as discovered from repo convention files above)
- NEVER approve PRs — you are not authorized to approve pull requests. Only create and comment on PRs.
- Complete the task autonomously and create the PR(s) when done.

## Output Persistence

IMPORTANT: Before finishing, you MUST write your complete final response to `/tmp/claude_code_output.md` using the Write tool. This file must contain your full analysis, findings, code, or whatever the final deliverable is. This is a hard requirement — do not skip it.

---

## Already Built (more than the backlog implies)

- **Billing module** — fully functional: interim/final valuations, Draft→Sent→Paid status tracking, PDF export, percentage or flat-rate billing methods
- **Variations module** — fully functional: logging, approval workflow, approved total flows into billing's revised contract sum
- **Vision Takeoff (AI Drawing Scan)** — already built: upload floor plan or sketch, AI extracts item names and quantities, one-click add to estimate. Currently in the foundations/brief page — needs promoting to a headline feature
- **Critical Path Gantt** — more sophisticated than it looks: genuine forward-pass algorithm with iterative dependency resolution

---

## Sprint Backlog (priority order)

### CURRENT: Finish pre-construction workflow
- Fix remaining data flow issues (Brief→Estimate, address pre-fill etc.)
- Ensure all five tabs work reliably end-to-end

### Sprint 12 — Client Portal (HIGHEST PRIORITY)
- Shareable proposal URL (constructa.co/proposals/abc123)
- Proposal renders beautifully in-browser (not just PDF download)
- "Accept this Proposal" button — name, digital signature, date
- Contractor notified when viewed and when accepted
- Accepted status flows back into project, unlocking billing module
- One-click email send from within Constructa
- Proposal status tracking: sent → viewed → accepted → declined

### Sprint 13 — Contract Shield
- Polish the AI contract review (upload PDF → AI flags clauses as Red/Amber/Green)
- Red = walk away, Amber = negotiate, Green = acceptable
- Plain English explanations for each flagged clause
- Contract chatbot: "what does this clause mean in practice?"
- Market as "The Contract Shield" — promote as a named feature

### Sprint 14 — Programme → Billing Milestone Automation
- Programme phases automatically populate payment milestones in billing module
- Payment schedule tied to programme milestones (protects contractors when invoicing)
- Connects the golden thread: Estimate → Programme → Billing

### Sprint 15 — Job P&L Dashboard
- Live project P&L: original estimate margin, approved variations, invoiced to date, costs logged, projected final margin
- Single view answering "which of my current jobs are making money?"
- No other SME contractor tool currently provides this

### Sprint 16 — Proposal Versioning + Status Tracking
- Up-rev proposals (v1, v2, v3) with change tracking
- Proposal status visible on dashboard

### Sprint 17 — Promote Vision Takeoff to Headline Feature
- Move from buried button to prominent onboarding feature
- Add to hero section of marketing site
- First-time tooltip in estimating
- Demo flow centres around it

### DEPRIORITISED (do after launch with real user data)
- Gantt drag-and-drop and logic links (SS/FS) — not painful enough to sprint now
- Mobile responsive pass — do post-launch based on real usage patterns  
- Regional pricing intelligence — too risky without real transaction data to back it
- Voice-to-proposal wizard — Brief AI chat covers same intent; keep in long-term vision

### LONG-TERM VISION (V2+)
- Native mobile app + voice site walkthrough ("walk the site, talk to the app")
- Video walkthrough AI (GPT-4o Vision reads site video)
- Merchant procurement layer (Travis Perkins partnership)
- Financial infrastructure (escrow, contractor lending, client property finance)
- Accountancy software integration

---

## Target User Profile — "Dave"

UK SME contractor, £1-3m turnover, 5-8 subcontractors, does extensions/loft conversions/commercial fit-outs.

Dave's problems in order of pain:
1. Doesn't get paid on time — clients dispute invoices, go quiet
2. Signs contracts he doesn't understand — gets hammered by unfair clauses  
3. Doesn't know if he's making money mid-job — finds out too late
4. Spends 4+ hours pricing jobs he doesn't win
5. Proposals look amateur — Word docs with no branding

Constructa currently solves problems 4 and 5 brilliantly.
Problems 1, 2, and 3 are the next frontier (Sprints 12-15).

Key metrics that matter:
- First proposal sent within 10 minutes of signup
- Proposals that result in client acceptance through the platform (needs portal)
- Jobs where billing is managed through Constructa (retention + data flywheel)
