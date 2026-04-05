-- Sprint 14a: Financial year start month for contractor companies
-- 1 = January, 4 = April (UK default), 7 = July, etc.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS financial_year_start_month INT DEFAULT 4
    CHECK (financial_year_start_month BETWEEN 1 AND 12);

COMMENT ON COLUMN profiles.financial_year_start_month IS
  'Month the company financial year starts (1=Jan, 4=Apr UK default, 7=Jul, etc.)';
