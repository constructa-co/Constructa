-- Add prelims_pct to estimates (separate from overhead/profit/risk)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS prelims_pct NUMERIC(5,2) DEFAULT 0;

-- Add line_type to estimate_lines to distinguish Labour/Plant/Material/Subcontract/Consultancy
ALTER TABLE estimate_lines ADD COLUMN IF NOT EXISTS line_type TEXT DEFAULT 'material';
-- Valid values: 'labour' | 'plant' | 'material' | 'subcontract' | 'consultancy' | 'general'

-- Add payment_schedule_type to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_schedule_type TEXT DEFAULT 'percentage';
-- Valid values: 'percentage' | 'milestone'

-- Fix cost library: update wrong units
UPDATE cost_library_items SET unit = 'm³' WHERE code = 'CON-003';
UPDATE cost_library_items SET unit = 'm³' WHERE code = 'CON-004';

-- Remove overly specific rebar item and replace with generic
UPDATE cost_library_items SET
  code = 'CON-005',
  description = 'Steel reinforcement bar (rebar) - supply only',
  unit = 'tonne',
  base_rate = 950.00
WHERE code = 'CON-005';

-- Add generic subcontract and consultancy items
INSERT INTO cost_library_items (user_id, tenant_id, code, description, unit, base_rate, category, is_system_default)
VALUES
  (NULL, NULL, 'SC-001', 'Subcontract works (provisional)', 'item', 0.00, 'Subcontract', TRUE),
  (NULL, NULL, 'SC-002', 'Specialist subcontractor (allow)', 'item', 0.00, 'Subcontract', TRUE),
  (NULL, NULL, 'CO-001', 'Structural engineer fee', 'item', 0.00, 'Consultancy', TRUE),
  (NULL, NULL, 'CO-002', 'Architect / designer fee', 'item', 0.00, 'Consultancy', TRUE),
  (NULL, NULL, 'CO-003', 'CDM / H&S consultant', 'item', 0.00, 'Consultancy', TRUE),
  (NULL, NULL, 'PC-001', 'Provisional sum (undefined works)', 'item', 0.00, 'Provisional Sums', TRUE)
ON CONFLICT DO NOTHING;
