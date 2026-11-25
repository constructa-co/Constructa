-- CON-068: persistent "Included (not charged)" intent for simple estimate lines.
-- Ambiguous legacy zero-rate placeholders are not treated as intentionally included
-- until the contractor confirms the flag in the estimating UI.

ALTER TABLE public.estimate_lines
    ADD COLUMN IF NOT EXISTS included BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.estimate_lines.included IS
    'When true with unit_rate 0, the line is deliberately included in scope at £0 (not charged).';

-- All existing and future unflagged rows stay false; never infer intent from a zero rate.
