# Owner walkthrough findings - 5 October 2026

## Status

**Result: partial walkthrough; release proof not passed.**

The owner completed the main contractor workflow on a laptop after mobile
authentication proved unreliable. The walkthrough reached proposal review but
did not complete publication, anonymous client response, sent-version evidence
or the final pipeline check.

The private source document and screenshots are not committed because they
contain test account and project details. This record preserves the product
evidence in sanitised form.

## What worked

- The account could be used successfully on a laptop once the isolated preview
  environment was corrected.
- The AI-assisted brief produced useful wording and the basic brief steps were
  understandable.
- Lump-sum pricing worked.
- Price adjustments worked.
- A minimum programme could be entered.
- The draft proposal was described as reasonably good, confirming that the
  underlying proposal-generation concept is viable.

## Stage 2F release-proof blockers

These must be repaired and re-tested before the owner walkthrough can pass.

1. **Preview environment isolation needs an automated guard.** The original
   preview inherited production Supabase variables. The deployment was removed
   and the replacement was verified against the disposable project, but future
   preview builds must fail rather than compile against production accidentally.
2. **Programme data is not faithfully represented in the proposal.** The owner
   entered multiple programme stages, but the proposal showed only one generic
   `General` stage and a one-week duration.
3. **Proposal readiness is not actionable enough.** The confirmation checkbox
   and send action appeared unusable because payment stages were missing. The
   requirement was technically shown elsewhere on the page, but the disabled
   control did not explain the blocker or take the user directly to it.
4. **Payment stages need quick, contractor-friendly presets.** At minimum:
   payment on completion, deposit plus balance, and custom stages.
5. **A downloadable PDF preview is needed before publication.** The contractor
   must be able to inspect the exact document before sending it to a client.
6. **Mobile remains unproven.** The owner could not complete access on the phone
   and moved to a laptop. Repeat the focused mobile journey after the blockers
   are repaired; do not count desktop completion as a mobile pass.

## Stage 3 product and UX requirements

### Onboarding and project setup

- Replace the prescriptive trade-button choice with guided text/AI capture that
  can recognise the breadth of real contractor trades.
- Add Back navigation so onboarding answers can be corrected.
- Capture a richer reusable company profile and introduction for proposals.
- Use structured address fields rather than one free-text project address.
- Derive suggested job types from the contractor's trade while allowing a
  custom answer; do not ask the same question twice under different labels.
- Remove the early rough-value field because estimating should establish the
  authoritative price.
- Remove repeated address, date and value questions from the brief.

### Guided estimating

- Preserve lump-sum pricing as the quickest route.
- Add simple measurement build-up, for example length x width = area.
- Let a rate be either an all-in unit rate or a build-up of labour, plant,
  materials and subcontract costs.
- Replace the current trade-button section creation with a smoother guided
  structure that suits different contractor types.
- Keep the running total visible near the work being edited and allow completed
  sections to fold away; do not require scrolling to the top for totals.
- Carry the AI assistant coherently across brief, estimate and proposal rather
  than presenting isolated generation controls on each page.

### Programme

- Seed optional programme stages from estimate line items instead of asking the
  contractor to start again.
- Keep the required light-touch programme: start date, duration and calculated
  finish date.
- Offer an optional elemental three-to-six-stage programme.
- Present elapsed time continuously; weekends must not look like unexplained
  holes in the visual flow.
- Unify the simple and detailed programme views around one data model and one
  visual language.

### Premium proposal

- Prepopulate company information, experience and reusable case-study content.
- Use brief, estimate and programme data to draft a complete project-specific
  scope instead of making the contractor repeat information.
- Integrate exclusions and clarifications into the guided authoring flow rather
  than leaving them as afterthoughts.
- Expand the controlled terms into a guided, versioned T&C experience while
  retaining the approved non-binding Phase 1 response posture.
- Produce a polished four-to-six-page brochure proposal that feels agency-made,
  not like a basic Word quote.
- Improve pagination so related content is kept together and page breaks feel
  intentional.
- Keep internal overhead, risk, profit and margin out of all client outputs.

## Delivery decision

Do not treat all comments as one visual-polish exercise. The recommended order
is:

1. Repair Stage 2F blockers and complete a shortened owner proof.
2. Establish the visual system and screenshot baseline in issue #24.
3. Implement the workflow redesign through issues #25-#27.
4. Complete the full mobile pass in issue #38.
5. Run the full owner walkthrough again before founding-cohort release.

## Retest scope after Stage 2F

- Sign in on a phone and laptop.
- Confirm programme stages and dates survive into the proposal preview.
- Select a payment preset and confirm readiness updates immediately.
- Download the exact PDF before publication.
- Publish an acknowledgement version and complete the anonymous response.
- Publish an optional non-binding intention-to-proceed version.
- Verify sent-version evidence and final pipeline status.
