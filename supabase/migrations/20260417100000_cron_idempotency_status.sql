-- P0-1 — Cron idempotency: add status column + unique-reservation constraint
-- so the cron can insert a reservation row BEFORE sending the email.
-- Without this, a cron retry or mid-run process death between the send
-- and the insert can cause duplicate time-bar emails.

alter table public.contract_alert_notifications
    add column if not exists status text not null default 'sent'
    check (status in ('pending', 'sent', 'failed'));

-- Drop the per-second uniqueness — it prevented reservation because
-- a freshly-inserted 'pending' row would collide with a same-second
-- 'sent' row on a retry. Replace with a reservation key that's
-- unique per (event|obligation, alert_type, stage). That makes the
-- insert itself the lock: a second cron run trying the same insert
-- will hit the constraint and we skip the send.
alter table public.contract_alert_notifications
    drop constraint if exists contract_alert_notifications_one_per_day;

-- Partial unique indexes — one for event-scoped rows, one for
-- obligation-scoped rows. Can't combine because null != null in
-- Postgres unique constraints (the old combined row trick is brittle).
create unique index if not exists contract_alert_notifications_event_key
    on public.contract_alert_notifications (user_id, event_id, alert_type, stage)
    where event_id is not null;

create unique index if not exists contract_alert_notifications_obligation_key
    on public.contract_alert_notifications (user_id, obligation_id, alert_type, stage)
    where obligation_id is not null;
