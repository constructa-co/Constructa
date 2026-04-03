# Constructa

Construction proposal, estimating, and project management platform for UK SME contractors.

**Live app:** https://constructa-nu.vercel.app
**Marketing site:** https://www.constructa.co

## What it does

Constructa guides contractors through a five-step pre-construction workflow:

1. **Brief** — AI-assisted project brief from natural language description
2. **Estimating** — Full Bill of Quantities with first-principles rate build-up (Labour + Plant + Materials)
3. **Programme** — Gantt chart auto-generated from estimated manhours
4. **Contracts** — T&C tier selection, AI risk register, contract review chatbot
5. **Proposal** — Professional PDF proposal pulling all the above together automatically

## Tech stack

- **Framework:** Next.js 14 App Router, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + RLS + Auth + Storage)
- **AI:** OpenAI gpt-4o-mini via `src/lib/ai.ts`
- **PDF:** jsPDF + jspdf-autotable
- **Deployment:** Vercel (auto-deploys from main branch)

## Getting started

1. Clone the repo
2. Copy `env.local.example` to `.env.local` and fill in credentials (ask project owner)
3. `npm install`
4. `npm run dev`

## Project context

See `CLAUDE.md` for full architecture documentation, database schema, workflow details, rules, and sprint backlog. This file is the canonical reference for any developer or AI assistant working on the project.

## Important

Do NOT modify anything in `src/app/(marketing)/` — that is the constructa.co landing page and is deployed separately.
