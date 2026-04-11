-- Sprint 59 — Contract alert notification idempotency.
--
-- The daily contract-alerts cron sweeps every user's open time bars
-- and overdue obligations and emails a digest if any exist. To avoid
-- spamming the same warning every day for two weeks, we record what
-- was sent and when. The cron consults this table to decide whether
-- the alert is "new" (never sent before), a "re-warn" (last sent more
-- than N days ago), or "already sent today" (skip).
--
-- Cadence rules implemented in the cron handler:
--   - First alert when an event/obligation enters the warning window
--     (time_bar <= 14 days, obligation overdue, or obligation due
--     within 7 days) — always sent
--   - Second alert 7 days later if still in the window
--   - Daily alerts in the final 3 days for time bars <= 3 days out
--   - Once status becomes 'complete' or the time bar passes its
--     expiry by more than 7 days, we stop notifying

create table if not exists public.contract_alert_notifications (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    -- One of these two will be set; the other will be null
    event_id        uuid references public.contract_events(id)      on delete cascade,
    obligation_id   uuid references public.contract_obligations(id) on delete cascade,
    -- What kind of alert this notification represents
    alert_type      text not null check (alert_type in (
        'time_bar_warning',
        'obligation_overdue',
        'obligation_due_soon'
    )),
    -- Stage of the cadence (1 = first alert, 2 = re-warn, 3+ = daily final-stretch)
    stage           int not null default 1,
    -- Days remaining at the time the alert was sent (for audit / debug)
    days_remaining  int,
    sent_at         timestamptz not null default now(),
    -- Resend message id so we can correlate with delivery logs
    resend_id       text,

    -- A given event/obligation can only get one notification per day per user
    constraint contract_alert_notifications_one_per_day
        unique (user_id, event_id, obligation_id, alert_type, sent_at)
);

create index if not exists contract_alert_notifications_user_idx
    on public.contract_alert_notifications (user_id, sent_at desc);

create index if not exists contract_alert_notifications_event_idx
    on public.contract_alert_notifications (event_id)
    where event_id is not null;

create index if not exists contract_alert_notifications_obligation_idx
    on public.contract_alert_notifications (obligation_id)
    where obligation_id is not null;

-- RLS — service role only writes; authenticated users can SELECT their own
-- notification history (useful for "last notified" UI in the contract admin
-- module if/when we add it).
alter table public.contract_alert_notifications enable row level security;

drop policy if exists "contract_alert_notifications_select_own"
    on public.contract_alert_notifications;
create policy "contract_alert_notifications_select_own"
    on public.contract_alert_notifications for select
    to authenticated
    using (user_id = auth.uid());

-- INSERT/UPDATE/DELETE locked to service role (the cron handler) — no
-- policy here means RLS rejects these operations from anon and
-- authenticated roles entirely.
