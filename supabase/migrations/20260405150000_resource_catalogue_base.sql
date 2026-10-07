-- Reconcile the resource catalogue tables that exist in the recovered live
-- schema but whose base CREATE statements were never committed. Keep fields
-- added by Sprint 16 and Sprint 51 in those later migrations.

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_resources (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                       TEXT NOT NULL,
  role                       TEXT,
  annual_salary              NUMERIC NOT NULL DEFAULT 0,
  employer_ni_pct            NUMERIC NOT NULL DEFAULT 13.8,
  employer_pension_pct       NUMERIC NOT NULL DEFAULT 3.0,
  company_car_annual         NUMERIC NOT NULL DEFAULT 0,
  it_costs_annual            NUMERIC NOT NULL DEFAULT 0,
  life_insurance_annual      NUMERIC NOT NULL DEFAULT 0,
  other_benefits_annual      NUMERIC NOT NULL DEFAULT 0,
  annual_working_days        INTEGER NOT NULL DEFAULT 260,
  holiday_days               INTEGER NOT NULL DEFAULT 25,
  public_holiday_days        INTEGER NOT NULL DEFAULT 8,
  overhead_absorption_pct    NUMERIC NOT NULL DEFAULT 15,
  profit_uplift_pct          NUMERIC NOT NULL DEFAULT 20,
  notes                      TEXT,
  is_active                  BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  title                      TEXT NOT NULL DEFAULT 'Mr',
  first_name                 TEXT,
  last_name                  TEXT
);

CREATE TABLE IF NOT EXISTS public.plant_resources (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                       TEXT NOT NULL,
  category                   TEXT NOT NULL DEFAULT 'other',
  description                TEXT,
  purchase_price             NUMERIC NOT NULL DEFAULT 0,
  depreciation_years         INTEGER NOT NULL DEFAULT 5,
  residual_value             NUMERIC NOT NULL DEFAULT 0,
  finance_cost_annual        NUMERIC NOT NULL DEFAULT 0,
  maintenance_annual         NUMERIC NOT NULL DEFAULT 0,
  insurance_annual           NUMERIC NOT NULL DEFAULT 0,
  other_annual_costs         NUMERIC NOT NULL DEFAULT 0,
  utilisation_months         INTEGER NOT NULL DEFAULT 10,
  working_days_per_month     INTEGER NOT NULL DEFAULT 20,
  profit_uplift_pct          NUMERIC NOT NULL DEFAULT 20,
  notes                      TEXT,
  is_active                  BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own staff resources" ON public.staff_resources;
CREATE POLICY "Users manage own staff resources"
  ON public.staff_resources
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own plant resources" ON public.plant_resources;
CREATE POLICY "Users manage own plant resources"
  ON public.plant_resources
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL PRIVILEGES ON TABLE
  public.staff_resources,
  public.plant_resources
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.staff_resources,
  public.plant_resources
TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.staff_resources,
  public.plant_resources
TO service_role;

COMMIT;
