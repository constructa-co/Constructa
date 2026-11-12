# Constructa Estimating and Programme Interface Benchmarks

18 October 2026. Initial benchmark review for A048-A063, with research tracked separately as A095.

## Robert's Estimating Direction

Robert selected STACK's clean presentation as the starting point, not a literal Excel/cloud-worksheet clone. Everyday pricing must be streamlined; deeper worksheet-style build-ups stay optional. Constructa does the mathematics, so contractors do not write formulas. A genuine job-aware chatbot should guide the process, with changes reviewed by the contractor. This is design direction, not acceptance of the existing partial implementation or provider activation.

The original research below remains reference material. This clarification supersedes any inference that spreadsheet complexity should be the default. See `estimating-benchmark-direction-20261018.json`. The subsequent programme selection is recorded below.

## Robert's Programme Direction

TeamGantt is Robert's winning overall visual reference, particularly the simpler illustrations in his two supplied screenshots. Start with an approachable labelled activity timeline, restrained purposeful colours, legible sequencing/dependency cues and visible milestones. Do not force an advanced scheduling worksheet on the phase-one user.

Robert's Smartsheet comments were mixed: he initially disliked its dependencies example, then described its advanced presentation as cleaner/right for advanced planning. Keep the cleaner advanced grid as a secondary cue, not an overall winner or blanket endorsement of its dependency UI. Advanced detail should remain optional and connected to the same reviewed job information.

The supplied current-versus-baseline bars and day-variance highlights are later tracking references. The illustrated sharing/export/invite controls are not execution instructions or proof those features exist. No calendar, automatic rescheduling, critical-path algorithm, baseline persistence or permission policy is selected by an image.

The long-term destination is one integrated platform contractors use to run projects, combining estimating, planning and project delivery. Preserve phase-two/three work and develop this in dependable stages, rather than separate estimate-only or schedule-only products. The visual foundation can be built incrementally; a reliable full platform is substantial product work, not an easy screenshot reproduction. This direction is tracked as A104, not completed implementation. See `programme-benchmark-direction-20261018.json` for the original attachment paths and qualifications.

Constructa should make detailed professional input efficient, not remove the detail that makes an estimate or programme credible. Use a simple visual programme first, with a full-width aligned working grid and expandable detail available when requested, plus an appropriate separate client-facing output.

This is a review of official public product pages and documentation, not a hands-on trial, a market-exclusivity finding, a performance ranking or proof of feature parity. Links below provide vendor explanations, screenshots or walkthroughs. Design recommendations are my inference, not features already implemented in Constructa.

## Estimating Benchmarks

| Reference | Documented input and output pattern | What to examine | Constructa recommendation |
| --- | --- | --- | --- |
| [STACK estimating](https://www.stackct.com/estimating/) | An estimating worksheet supports configurable line items, frozen columns and grouping by trade, phase or custom category. Items/assemblies feed estimates and proposal breakdowns. | Worksheet density, grouping, subtotals and keeping context while editing. | Use one main cost table grouped by the contractor's real activities, not a catalogue of unrelated trades. |
| [Buildxact recipes](https://help.buildxact.com/en/articles/2997432-creating-assemblies-recipes) | A recipe combines resource items with quantities, units and costs for one unit of work. Recipes can be reused, saved from an estimate, or imported from Excel with mapping and an error preview. The article includes a walkthrough video. | The journey from a priced item into its underlying components, and back to a reusable item. | Expand a line into multiple labour/material/plant/subcontract components while retaining a fast all-in option. Reuse reviewed contractor recipes later rather than force every build-up from scratch. |
| [RIB Candy](https://www.rib-software.com/en/rib-candy) | First-principles resource estimating links the bill of quantities, estimate and programme, with traceable calculations and reusable libraries. | Professional depth and the relationship between priced work and planned activities. | Use this as a capability reference, not a literal browser-interface template or an instruction to reproduce the whole suite. Keep quantity, resource assumptions, cost and selling-price adjustments understandable. |

None of these examples justifies invented rates, automatic trade assumptions or importing a vendor's rounding/waste policies. Those must remain explicit Constructa decisions.

## Programme Benchmarks

| Reference | Documented input and output pattern | What to examine | Constructa recommendation |
| --- | --- | --- | --- |
| [GanttPRO grid and timeline](https://help.ganttpro.com/hc/en-us/articles/5733574273169-GanttPRO-s-fundamentals) | Task details sit in a left-hand grid beside a right-hand Gantt. Columns can be resized, reordered and hidden; summary tasks, subtasks, milestones and dependencies organise the plan. | Table/timeline row alignment and progressive disclosure of planning detail. | Put activity entry and the corresponding bar on the same row, with a resizable divider rather than separate disconnected forms. |
| [TeamGantt scheduling](https://www.teamgantt.com/platform/project-scheduling/) | Plans can start from templates/imports or an AI draft, then be adjusted through linked tasks, lead/lag, milestones and timeline edits. List and Gantt views serve different levels of detail. | A readable plan that can be edited without abandoning the visual result. | Keep an approachable elemental view, with deeper dependencies available when needed. Any assistant should propose an editable plan, not conceal assumptions or commit it automatically. |
| [Smartsheet dependencies](https://help.smartsheet.com/articles/765727-enabling-dependencies-using-predecessors) | Duration and predecessor inputs drive dates using the defined working-day schedule. Working duration and elapsed duration are distinguished; zero-duration tasks are milestones. | Explicit calendar semantics and the relationship between input cells, calculated dates and output. | Resolve Constructa's existing date mismatch first. The grid, Gantt summary and proposal must agree under one defined calendar; weekend shading must not silently change working policy. |

The general arrangement is a design reference. It is not permission to import another product's calendars, default dependencies, automatic rescheduling or save behaviour.

## General SaaS Data Entry Benchmark

[Airtable record details](https://support.airtable.com/articles/5805061650-airtable-interface-layout-record-detail) demonstrates opening a resizable detail drawer while leaving the original page visible. It can group additional fields and related information without forcing every field into the main view.

For Constructa, use a selected line's detail area for resource build-ups, notes, assumptions or exclusions. Keep the surrounding estimate, selected row and totals visible. This pattern is worth comparing against inline expanded rows; it is a recommendation to test, not a final selected layout.

## Proposed Constructa Input Structure

| Workspace | Main working surface | Detail shown when requested | Output |
| --- | --- | --- | --- |
| Estimate | Activity/section, description, quantity, unit, rate and line amount, with section totals. | Resource rows with type, description, quantity per unit of priced work, resource unit, rate and calculated contribution; notes and reviewed assumptions. | A reviewed estimate and appropriate client-facing pricing breakdown, without exposing internal resource details by default. |
| Programme | Simple labelled activity timeline first; an aligned activity/duration/predecessor/date grid when advanced detail is requested. | Milestones, lead times, client decisions, resource considerations and explicit calendar settings; later current/baseline comparisons. | A clean elemental proposal timeline and an optional detailed contractor plan using consistent dates. |
| Assistant | A contextual side panel tied to selected work and existing job information. | Questions, proposed activities/build-ups and clearly marked missing assumptions. | Reviewed changes applied deliberately to the same data, not a parallel chat-only estimate. |

These are proposed presentation and interaction concepts. Persistence, internal-detail disclosure, financial adjustments, calendar rules and provider execution still require source-grounded implementation and verification. Existing saved work and calculation contracts must remain intact.

## Concrete Comparison Tasks Before Major Redesign

Use the same hypothetical kitchen job in each design evaluation. Do not put real client information into third-party trials.

1. Bring existing brief activities into the estimate without entering them again.
2. Enter several price lines rapidly, then expand one into multiple resource components and return to the overview without losing position.
3. Check quantity/unit assumptions, distinguish underlying cost from selling price, and see the effect of an edit in the totals.
4. Turn reviewed work into three elemental programme activities; add a milestone and a procurement dependency.
5. Change one duration and explain every resulting date/bar change using the selected working calendar.
6. Produce a concise client-facing price and timeline from the same reviewed information without retyping it.

Measure task completion, errors, keyboard steps, lost context and clarity of calculated values. No usability scores or speed claims have been measured in this initial review.

## Direction To Carry Into Implementation

Use STACK as the estimating presentation starting point, with simplicity first and optional advanced detail. Buildxact/Candy remain capability references; Airtable remains an optional detail-reveal pattern, not an approved full layout. Use TeamGantt as the leading programme visual reference, especially the supplied simpler timelines; Smartsheet's cleaner advanced grid is a secondary cue. Retain the long-term integrated project-platform direction without expanding phase one into an unverified full-suite claim.

The goal is an easy contractor pricing experience with software-managed calculations and genuine guided assistance. Spreadsheet-style depth is available when needed, not imposed on every estimate. Research delivery does not complete estimating, programme or assistant implementation; use the action register for each action's current status.

