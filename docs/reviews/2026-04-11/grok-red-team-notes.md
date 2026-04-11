# Grok Red Team Review — 11 April 2026

Informal red-team commentary from Grok on the Constructa codebase and the
Perplexity audit. Preserved verbatim (the parts relevant to the codebase)
so future sessions have the raw source. Personal/conversational preamble
trimmed for signal-to-noise.

---

## Grok's initial strategic analysis (summary)

- **Overall verdict:** Constructa has the strongest foundation in the UK SME
  construction SaaS space. Breadth 10/10, depth/polish/robustness 4/10.
- **Vision check:** The "Golden Thread of Data" (atomic resources → estimate
  → schedule → actuals → reconciliation → accounting) is the right strategic
  bet. The 5-step pre-construction workflow with auto data flow between tabs
  is the killer differentiator vs traditional tools.
- **Top 3 pain points for "Dave" (£1-3m contractor persona):**
  1. Proposal/PDF feels functional but not "send-it-immediately premium".
  2. Live cost logging is a 6-tab monster — too many clicks on site.
  3. 5-step wizard is overkill for £5k-£50k jobs that make up ~70% of
     contractor work.

## Grok's gap analysis table (prioritised)

| Area | Gap | Priority |
|---|---|---|
| Proposal/PDF | Typography, conditional sections, version history, blank-space handling | HIGH |
| Live project delivery | One-tap cost capture, photo attachments, team collab, offline | HIGH |
| Programme & change mgmt | Real-time variation impact on programme, drag-drop | High |
| Cost reconciliation | True atomic estimate-vs-actual matching with drill-down | High |
| Notifications & compliance | NEC time-bar engine, auto-reminders, audit trail | HIGH |
| Data moat / benchmarks | Needs volume but powerful once live | Long |
| Mobile & field | Dedicated mobile flows + offline + push | High |
| Onboarding & delight | Progress autosave, one-click actions, PDF themes | High |

## Grok's "Quick Quote" proposal

- Add a "Quick Quote" button on dashboard/home and pipeline.
- Template picker per trade (Kitchen Extension, Loft, Driveway, etc.).
- Pre-fills brief + basic estimate.
- Skips full 5-step wizard for simple domestic jobs.
- Still saves everything to the Golden Thread under the hood so larger
  projects can expand later without data loss.

## Grok's response to the Perplexity audit

Grok sharpened his verdict after reading Perplexity:

- "This is no longer 'solid foundation with some polish needed'. This is
  'impressive breadth built on cracking foundations'."
- Called out four exploitation paths a chaotic user could hit today:
  1. Server-action bypass if RLS hiccups — RLS has already failed once
     (circular dependency bug in migration `20260324000006`).
  2. Input poisoning (negative quantities, garbage dates).
  3. White-screen DoS — no `error.tsx` anywhere.
  4. Test-data time bomb ("TEST SCROLL..." visible in live pipeline).

## Grok's proposed phasing

**Week 1 — make it not embarrassing**
1. Fix every visible handover bug + Perplexity issues.
2. Add `requireAuth()` helper + apply to every mutating server action.
3. Drop `error.tsx` + `loading.tsx` into dashboard and projects route groups.
4. Add Zod validation to the 6 highest-risk actions.

**Week 2 — Quick Quote path**
5. One-click "Quick Quote" button + template picker.
6. Pre-fill brief + basic estimate.
7. Still save to full Golden Thread under the hood.

**Week 3 — ruthless simplification**
8. Autosave everywhere.
9. One-tap cost capture in live projects.
10. Extract shared PDF service.

**Week 4 — break-proofing**
11. 20-30 Vitest tests on financial calcs, contract sum, PDF, P&L.
12. Fix sidebar project context sync + reporting project selector.
13. Make "On Track" RAG honest when forecast is in the red.

## Claude's assessment of Grok's contribution

- **Strategic framing:** Valuable. The "test → break → strengthen →
  streamline" order is correct, and the "no new features, harden first"
  directive is the right call for this stage.
- **Factual accuracy:** Mixed. Grok correctly identified that `VISION.md`
  exists in the repo, and his Red Team instincts on auth and error
  boundaries are sound. But he described the handover as "2,500 words"
  when it's ~12,000, and his Week 2 "Quick Quote" path risks fragmenting
  the codebase before the primary flow is robust.
- **Contradiction flagged:** Grok lists "mobile PWA underdeveloped" as a
  gap, but Sprint 49 already shipped the PWA (manifest, service worker,
  offline fallback, on-site hub). The real gap is content *inside* the
  mobile hub (one-tap cost capture), not PWA infrastructure.
- **Overall value:** Use Grok as strategic pressure and as a reasonableness
  check. Defer to Perplexity's codebase analysis for file-level specifics.
