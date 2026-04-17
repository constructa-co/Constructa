-- P0-3 — Proposal validity period per project.
--
-- home-client.tsx has always read p.validity_days but the column
-- never existed on projects — the "expiring soon" banner silently
-- defaulted to 30 days for every project. This migration makes it
-- real, with a sensible default and an editable UI exposed in the
-- proposal editor.

alter table public.projects
    add column if not exists validity_days integer not null default 30;
