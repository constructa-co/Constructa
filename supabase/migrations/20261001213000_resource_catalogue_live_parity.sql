-- Converge clean replay with the recovered live resource-catalogue metadata.
-- Sprint 16 introduced these columns before their final defaults/nullability
-- were applied out of band.

BEGIN;

UPDATE public.staff_resources
SET
  hourly_chargeout_rate = COALESCE(hourly_chargeout_rate, 0),
  overtime_chargeout_rate = COALESCE(overtime_chargeout_rate, 0),
  car_allowance_annual = COALESCE(car_allowance_annual, 0),
  mobile_phone_annual = COALESCE(mobile_phone_annual, 0)
WHERE hourly_chargeout_rate IS NULL
   OR overtime_chargeout_rate IS NULL
   OR car_allowance_annual IS NULL
   OR mobile_phone_annual IS NULL;

ALTER TABLE public.staff_resources
  ALTER COLUMN rate_mode SET DEFAULT 'simple',
  ALTER COLUMN hourly_chargeout_rate SET NOT NULL,
  ALTER COLUMN overtime_chargeout_rate SET NOT NULL,
  ALTER COLUMN car_allowance_annual SET NOT NULL,
  ALTER COLUMN mobile_phone_annual SET NOT NULL;

UPDATE public.plant_resources
SET daily_chargeout_rate = 0
WHERE daily_chargeout_rate IS NULL;

ALTER TABLE public.plant_resources
  ALTER COLUMN daily_chargeout_rate SET NOT NULL;

COMMIT;
