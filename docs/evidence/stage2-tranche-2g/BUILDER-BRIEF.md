# Stage 2G.1 Builder Brief: Guided Activation

Issue: https://github.com/constructa-co/Constructa/issues/90

Base commit: `47acd2b161515004f950bf7644c0ed9c73f8dc67`

Branch: `claude/stage2-tranche-2g1-onboarding-activation`

Worktree: `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/constructa`

## Programme Boundary

This is Constructa only. Do not inspect, reference or modify QuantFund, crypto-trading-unified or any other repository. Do not change production data, production credentials, production deployment settings or marketing routes. Do not merge.

Stage 2F and PR #89 are the green regression baseline. This tranche must preserve their signup reliability, idempotent welcome email, retry behaviour, back navigation, mobile accessibility and launch-route gating.

## User Context

The target user is a small or medium UK contractor who often comes from a trade background and may be uncomfortable with software. The product should not ask them to design a profile or write AI prompts. Constructa should ask short, concrete questions, explain why each answer matters and progressively build reusable proposal content.

The owner has chosen:

- start blank rather than force a generic contractor template;
- use guided AI later to interview the contractor;
- keep a minimum setup path fast;
- allow multiple disciplines because relevant company content and case studies vary by job type;
- produce premium proposal content without inventing facts.

## Objective

Replace the current prescriptive primary-trade button wall with a flexible, plain-language activation flow and add a proposal-readiness landing page. A first-time contractor must be able to finish the minimum setup on a phone and either create a project immediately or continue enriching company content.

## Required Implementation

### 1. Guided work-type capture

- Replace the fixed `SETUP_TRADES` choice wall as the primary interaction with one free-text answer to a prompt such as: “What kind of work does your business do?”
- Use examples and optional suggestion chips to help, not constrain, the answer.
- Preserve the existing `profiles.business_type` storage contract for this slice.
- Do not introduce an AI network call yet. This is the stable UI/data foundation for the later interview.
- Retain input limits, server-side validation, error recovery and idempotent save behaviour.

### 2. Business identity step

- Keep business/trading name required and user name optional.
- Explain that the business name is client-facing and can be changed later.
- Preserve the existing server action and welcome-email guarantees unless a small, tested change is required.

### 3. Proposal-readiness landing page

- After initial setup, take a first-time contractor to a new focused readiness surface rather than directly into a large settings form.
- Show a concise welcome, the saved business/work type and two obvious paths:
  - primary: create the first project;
  - secondary: build the company profile.
- Show progressive, honest status for these reusable proposal ingredients using existing profile data only:
  - company basics;
  - logo/brand;
  - company story/capability;
  - case studies;
  - terms (may display “later” or “not set up”; do not invent completeness).
- The page must not imply that every item is mandatory before creating a project.
- Reuse established Stage 2 visual patterns, but make the layout deliberate, premium and phone-first.

### 4. Resume and existing-user behaviour

- Existing configured users must not be forced through onboarding again.
- Direct return to onboarding must remain safe and editable.
- A first-time user may leave the readiness page and resume enrichment later.
- Do not expose hidden Phase 1 modules through actions or navigation.

## Explicit Non-Goals

- Website crawling or competitor research.
- AI chat/interview implementation.
- New discipline or case-study tables.
- T&C generation or legal wording changes.
- Bank/payment details.
- Public company microsites.
- Proposal document redesign.

These are later slices under issue #90 and must not be pulled into this PR.

## Files To Inspect First

- `src/app/onboarding/page.tsx`
- `src/app/onboarding/onboarding-client.tsx`
- `src/app/onboarding/actions.ts`
- `src/lib/first-session.ts`
- `src/lib/first-session.test.ts`
- `src/app/dashboard/settings/profile/page.tsx`
- `src/app/dashboard/settings/profile/profile-form.tsx`
- `src/app/dashboard/settings/case-studies/page.tsx`
- `src/lib/launch-profile.ts`
- `e2e/phase1.spec.ts`
- `docs/evidence/stage2-tranche-2e/OWNER-WALKTHROUGH-FINDINGS.md`

## Testing Required

- Add or update focused unit tests for input validation, setup progression and landing-path resolution.
- Add E2E coverage for a new user completing minimum setup and reaching the readiness page.
- Verify primary and secondary readiness actions.
- Verify existing-user onboarding return/edit behaviour.
- Verify a failed save can retry without duplicate side effects.
- Verify 390 x 844 and 1280 x 800 layouts.
- Run `npx tsc --noEmit`, `npx vitest run`, `npx next build` and the relevant Playwright slice.

## Evidence Required

- Desktop and mobile screenshots for each activation step and the readiness page.
- Exact test commands and results.
- Files changed and rationale.
- Risks, assumptions and anything deliberately deferred.
- Commit the result on the stated branch, but do not push, open a PR, merge or deploy.

## Review Standard

Prefer a small, legible implementation over abstractions for future slices. Do not broaden the schema in anticipation of later work. Treat all AI-generated or imported company content as unapproved until a future explicit approval workflow exists.
