# Constructa Project Handoff Brief

## 1. Introduction and Vision
**Constructa** is designed to be a "Vertical ERP for Construction," moving beyond simple estimating to create a unified platform that connects estimating, scheduling, reconciliation, and accounting.

**The "Golden Thread" of Data Philosophy:**
The core rule of Constructa is the "Atomic Rule"—the application must *never* store flat costs. Instead, it stores "recipes" (e.g., "Wall = 4 hours Labour @ £25 + 100 Bricks @ £1"). This atomic data allows subsequent features (like the Auto-Scheduler or Procurement) to use the raw hours and material quantities derived from the initial estimate.

Our goal is to act as the "Pre-Accounting" layer (initially exporting to Xero/Sage) with the long-term vision of becoming the primary financial operating system for SMEs in the construction sector.

---

## 2. Technology Stack & Architecture
- **Frontend/Framework:** Next.js (App Router), React, TypeScript.
- **Styling:** Tailwind CSS, `shadcn/ui` (Slate color scheme), lucid-react icons.
- **Backend/Database:** Supabase (PostgreSQL) handling Database, Authentication, and Storage.
- **Security:** Strict Row Level Security (RLS) on all tables, isolating data via an `organization_id` model.
- **AI Integration:** Google Generative AI (`gemini-1.5-flash`) for automated processing (Vision, Proposal generation, Contract generation).
- **Key Libraries:** `papaparse` (CSV import), `jspdf` & `jspdf-autotable` (PDF export), `expr-eval` (formula parsing).
- **Deployment:** Vercel (CI/CD connected to GitHub).

---

## 3. What We Have Built Together (Day 1 to Present)

We have systematically executed the roadmap, transforming the prototype into a "Team Ready," scalable SaaS foundation.

### Core Modules Developed:
1. **The Estimator Engine:** Interactive calculations using first-principles recipes, supporting add-ons and markups.
2. **Resource Manager:** Centralized management of Staff (Labour) and Plant rates.
3. **Cost Library (Nested MoM Model):** A highly structured, hierarchical "Master of Measure" library for categorizing rates.
4. **CSV Importer:** Bulk upload tool with auto-mapping for easy onboarding of external cost data.
5. **Template Engine (Kits):** Ability to bundle atomic library items into reusable "Assembly Kits" for one-click pricing.
6. **Project CRM Pipeline:** A Kanban-style 5-column board for managing projects through their lifecycle, with real-time financial roll-ups.
7. **AI Vision Takeoffs:** Integration with Gemini Vision to analyze uploaded floor plans/sketches and automatically extract items (doors, windows) into the estimator.
8. **Smart Proposals & Contracts:** AI-driven generation of professional narratives and JCT-style legal agreements, natively integrated with `jspdf` for client execution.
9. **Billing & Valuations Engine:** Interim and final invoice generation with a dedicated financial summary interface.
10. **Premium Landing Page:** A pixel-perfect, highly polished marketing page (`/`) featuring glassmorphism, scroll-based animations, and strict brand adherence.

---

## 4. The Recent Architectural Overhaul
We recently completed a massive backend refactor to eliminate technical debt and prepare for team scalability:

- **Organization-Based Ownership:** Transitioned from a single-user `user_id` model to an `organization_id` model. Created `organizations` and `organization_members` tables. All core entities are now isolated by Org ID via hardened RLS policies.
- **Nested MoM Consolidation:** Deprecated fragmented, flat legacy library structures in favor of a unified Nested Master of Measure (`mom_categories` and `mom_items`) architecture.
- **Transactional Integrity:** Implemented Supabase RPCs (Stored Procedures), such as `create_valuation_and_invoice`, to ensure complex financial operations are strictly atomic.
- **AI Hardening:** Refactored all Gemini interactions to use **Structured JSON Outputs**, eliminating parsing errors and ensuring 100% reliable technical scope execution.

---

## 5. Current System State
The application has just undergone a critical stabilization phase:
- **Blank Page Debugging:** Resolved a fatal Next.js client/server boundary leak by enforcing `"use server"` directives traversing client components.
- **Design System Recovery:** Purged destructive legacy CSS that was overriding the Tailwind styling on the landing page.
- **Environment Status:** The local environment is healthy. The remote GitHub repository is fully synchronized (`origin/main`), and Vercel has successfully deployed the latest, stable, visually restored version.

---

## 6. Next Steps for Perplexity Computer
As you take over development, please focus on the following immediate priorities:

1. **AI Vision & MoM Integration:** Connect the newly consolidated MoM `cost_library` directly into the AI Vision Takeoff flow. The AI should map recognized items (e.g., "Door") to actual atomic rates in the organization's library.
2. **User Custom Rates:** Implement UI/UX allowing users to easily extend or override the master library with their own custom rates.
3. **Payment Gateway Integration:** Connect the Billing engine to Paddle (or Stripe) for automated VAT/Tax compliance and subscription management to finalize the SaaS monetization loop.
4. **Continued UX Polish:** Ensure that any new interfaces strictly adhere to the established `shadcn/ui` dark-mode aesthetic, utilizing the `Slate` variables defined in `globals.css`.
