# D92-M1 — proposal price integrity parity (held schema draft)

Owner: R1. Source defect independently reproduced against main78ee1c4 after Claude Sonnet critique. Draft only: no merge or hosted SQL application. D86 stopped at unhealthy approved practice project with no backups. This is **outside** the approved five-PR apply sequence and cannot be silently added.

The application computes PC/provisional sums at face value, includes credits, and ignores blank preliminaries when deciding whether to use a percentage. The publication RPC used older rules and refused valid prices. Example £10,000, prelims10%, overhead10%, risk5%, profit15%: ordinary £14,610.75; +£5,000 PC = £19,610.75, while old RPC demanded £21,916.13. Blank prelims demanded £13,282.50 and a £500 credit was ignored. The equality guard correctly fails closed; it must not be weakened.

The additive function replacement changes only recomputation. It preserves owner/membership checks, row locks, immutable snapshot/amount guards, grants and delivery behavior. Missing/NULL markup_method keeps legacy compounding; an explicit on_net field is read through to_jsonb for compatibility with separately held #176. No column/default is introduced. Main must not be run against newly on_net estimates before its matching source package is approved.

The existing disposable publication SQL suite now invokes the actual RPC for ordinary work, PC/PS allowances, blank/explicit/negative prelims, credits, face-only/stale fallback, zero/legacy fallback, unknown line types, discount, worked groundworks example and future on_net. Each base case rejects a penny mismatch; foreign ownership remains refused. No real account/send/provider or hosted database is used. Final CI/reviewer receipts are recorded in the private handoff and PR body, without implying hosted acceptance.

Before any later apply: Rob must approve an exact combined candidate/order with #176 and its function definitions, actual verified target, preapply function/privilege/data backup and recovery, healthy practice replay and runtime parity. Restore only the verified actual preapply function if recovery is authorised; no guessed hosted definition, no destructive column rollback.

## D100 readiness addendum — rollback (23 Nov)

`supabase/rollbacks/20261122120000_d92_proposal_price_parity.rollback.sql` is **not a migration** and is never auto-applied. It restores the exact pre-D92 `publish_proposal_publication` function and grants (byte-identical block from `20260930150000_proposal_publication_foundation.sql`, the only earlier definition). Function-only: no table, column or data change; published proposals/snapshots are untouched.

Disposable proof (`npm run test:proposal-sql`, CI only): rollback block byte-matches the foundation; applying it restores old price behaviour (PC-allowance price refused), grants unchanged (anon none, authenticated/service_role execute), publication row count unchanged; re-applying the forward migration restores parity. Production use needs Rob plus a verified preapply function backup. Merged with current main (af3d342); only conflict was the changelog (both entries kept).
