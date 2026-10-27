# Constructa Delivery Handoff - 27 October 2026

## A059 Candidate

Authorised Composer commit `aa6d34955ed836de0fe44e007a79f8174e20a7d1`
adds a router refresh after the existing successful Next: Proposal navigation.
Its new tests cover the navigation call and an all-week working pattern in the
proposal. This is not evidence of a real server/database round trip.

The accompanying two-file native test adds an explicit saved seven-day
calendar to the existing detailed Gantt fixture. Friday 13 November plus three
working days finishes Sunday 15 November. The painted bar is measured against
the Monday 9 November grid: four-day offset, three-day width, four-week axis.
Legacy short/long fixtures and existing assertions are retained.

Composer reports the new native case, one affected retained legacy case and
affected lint passed. Its retained browser JSON directly records the legacy
case; that run overwrote the new-case JSON. The new-case pass is therefore
attributed to the worker report, not a separately retained coordinator result.
Kimi independently reran the five targeted files: 108 passed. Its broader
proposal-file selection also passed the new all-week case but exposed one
unrelated About-credentials expectation failure (140 passed, one failed
overall). That broader batch is not represented as a clean pass.

Before backup: the original full npm build, TypeScript and Supabase target
guard must pass on these exact bytes; source and unpublished-range secret
scans must pass; only the backup branch may be pushed and independently matched.
The private exact-input receipt is `rob2027-a059-build-20261027.json`.

The initial build compiled but failed TypeScript in the new navigation test's
unnarrowed React children index. Codex narrowed that selector only; the same
affected case and lint are checked again before a fresh exact-input build.
The failed build and initial runner-startup refusal are retained privately.
The passing retry used host-PATH Node 26; it is retained but is not the final
supported-engine check. The final required Node 24 receipt is
`rob2027-a059-build-node24-20261027.json`.

A059 remains Partial: calendar SQL is not applied and real QA
save/reopen/readback is not run. Shifts, capacity and timezone scope is not
silently closed. The previously reported 14 planner date-label failures did
not reproduce in Kimi's check: all 91 cases in the three named files passed.
No speculative date-label repair is mixed into this delivery. The unrelated
About-credentials expectation remains a separately recorded baseline issue.

## A023 And A091

A023 owner: Cursor Composer 2.5 app, separate Constructa job. Its source-only
QA runner was returned and rejected before integration: it waited for a browser
Supabase signup response even though signup is a server action; it omitted a
real email-confirmation handoff and allowed consent readback to be skipped;
failure traces/screenshots conflicted with the no-credential-recording rule;
and its readback omitted the exact document and server timestamp assertions.
No candidate runtime was executed. Real signup, SQL apply and Preview changes
remain held. Existing checkbox, accessible full terms, trusted revision,
session-bound recorder and confirmation honesty are retained. No new real
consent record or Complete status is claimed.

A091 review verdict: accept `288c096..7b60157` as a bounded local MOCK
integration-test seam. Refusal precedes mutation, explicit working-pattern
acknowledgement is copied, and the proposal receives the acknowledged pattern.
It does not prove full marketing/signup/email/consent or durable hosted flow.
The exact two-file patch was posted in Rob's Constructa inbox on 27 October.

## A079 And Friday Merge

A079 follows A091. Existing app/programme backups do not prove independent
DB/Auth/Storage restoration, required Git history/refs/assets, private or unsaved
work, or the previously skipped constructa-ops export. Reuse existing approved
private recovery material; no new export/restore or credentials operation has
been performed. A079 remains Partial.

Propose one small curated A059/A091 candidate by Friday 30 October, not a
wholesale backup merge. Test the exact candidate against then-current main,
with green CI, original build and no-publication E2E. Include only reviewed
dependencies. No signup enablement, migrations or unrelated backup history.
No main push, merge, deploy or settings change without Rob's separate yes.

## Records And Authority

The repository register is a compact 118-ID delivery-status snapshot. The full
append-only historical register and detailed execution receipts remain in the
private Constructa evidence store, with the current 27 October record outside
the stale app checkout. No historical instructions are cleared.

Rob's direct standing app approval: Codex drives authorised app tasks and
routine task-bound approvals through results without repeated permission
questions. Exact Constructa ownership and existing safety boundaries remain.
Grok has no assigned job. Claude is prepared on the trusted fresh folder but
the 20:15 CTO instruction reserves its work until after 22:00.
