-- P1-9 — Indexes for the daily contract-alert cron.
--
-- The cron at /api/cron/contract-alerts filters contract_events by
-- time_bar_date IS NOT NULL (and equality on status 'open'), and
-- contract_obligations by due_date IS NOT NULL + status != 'complete'.
-- With only a handful of rows the sequential scan is fine, but as beta
-- users onboard (10 contractors × 5 projects × 10 open events = 500+
-- rows) the cron will start bottlenecking. Adding partial indexes now
-- is cheap and makes the cron future-proof.

create index if not exists idx_contract_events_time_bar_date
    on public.contract_events (time_bar_date)
    where time_bar_date is not null;

create index if not exists idx_contract_obligations_due_date
    on public.contract_obligations (due_date)
    where due_date is not null and status <> 'complete';
