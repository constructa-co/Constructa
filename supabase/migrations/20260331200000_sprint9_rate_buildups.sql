-- Sprint 9: Rate Build-Up Components & Library
-- First-principles rate build-up for estimate lines

-- 1. Track whether a line uses simple or buildup mode
ALTER TABLE estimate_lines ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'simple';
-- Values: 'simple' | 'buildup'

-- 2. Component rows for first-principles rate build-up
CREATE TABLE IF NOT EXISTS estimate_line_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_line_id UUID NOT NULL REFERENCES estimate_lines(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL, -- 'labour' | 'plant' | 'material' | 'consumable' | 'temp_works' | 'subcontract'
  description TEXT NOT NULL,
  quantity NUMERIC(12,4) DEFAULT 1,
  unit TEXT DEFAULT 'nr',
  unit_rate NUMERIC(12,2) DEFAULT 0,
  line_total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_rate) STORED,
  -- Labour-specific: manhours for Gantt population
  manhours_per_unit NUMERIC(8,2) DEFAULT 0, -- hours per unit of parent line (e.g. 0.25 hrs per m3 concrete placed)
  total_manhours NUMERIC(10,2) GENERATED ALWAYS AS (quantity * manhours_per_unit) STORED,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elc_line ON estimate_line_components(estimate_line_id);

ALTER TABLE estimate_line_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY elc_select ON estimate_line_components FOR SELECT
  USING (estimate_line_id IN (
    SELECT el.id FROM estimate_lines el
    JOIN estimates e ON el.estimate_id = e.id
    JOIN projects p ON e.project_id = p.id
    JOIN organization_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY elc_insert ON estimate_line_components FOR INSERT
  WITH CHECK (estimate_line_id IN (
    SELECT el.id FROM estimate_lines el
    JOIN estimates e ON el.estimate_id = e.id
    JOIN projects p ON e.project_id = p.id
    JOIN organization_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY elc_update ON estimate_line_components FOR UPDATE
  USING (estimate_line_id IN (
    SELECT el.id FROM estimate_lines el
    JOIN estimates e ON el.estimate_id = e.id
    JOIN projects p ON e.project_id = p.id
    JOIN organization_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY elc_delete ON estimate_line_components FOR DELETE
  USING (estimate_line_id IN (
    SELECT el.id FROM estimate_lines el
    JOIN estimates e ON el.estimate_id = e.id
    JOIN projects p ON e.project_id = p.id
    JOIN organization_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
  ));

-- 3. Rate build-up library -- save built-up rates for reuse
CREATE TABLE IF NOT EXISTS rate_buildups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL org = system default (Constructa global library)
  name TEXT NOT NULL, -- e.g. "Place concrete ground slab 150mm"
  unit TEXT NOT NULL, -- e.g. "m2"
  built_up_rate NUMERIC(12,2) NOT NULL, -- total rate per unit
  trade_section TEXT,
  components JSONB NOT NULL DEFAULT '[]', -- array of component objects
  -- Each component: { type, description, quantity, unit, unit_rate, manhours_per_unit }
  total_manhours_per_unit NUMERIC(8,2) DEFAULT 0,
  usage_count INT DEFAULT 0,
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rate_buildups ENABLE ROW LEVEL SECURITY;

CREATE POLICY rbu_select ON rate_buildups FOR SELECT
  USING (is_system_default = TRUE OR organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY rbu_manage ON rate_buildups FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- 4. Seed a few system rate build-ups as examples
INSERT INTO rate_buildups (name, unit, built_up_rate, trade_section, components, total_manhours_per_unit, is_system_default)
VALUES (
  'Excavate trench by machine (600mm deep)', 'm',  28.00, 'Groundworks',
  '[
    {"type":"plant","description":"5t excavator","quantity":0.025,"unit":"day","unit_rate":380,"manhours_per_unit":0},
    {"type":"labour","description":"Groundworker","quantity":0.05,"unit":"day","unit_rate":260,"manhours_per_unit":0.4},
    {"type":"material","description":"Disposal of spoil","quantity":0.6,"unit":"m3","unit_rate":45,"manhours_per_unit":0}
  ]'::jsonb,
  0.4, TRUE
),
(
  'Place concrete ground slab 150mm C25/30', 'm2', 42.00, 'Concrete',
  '[
    {"type":"material","description":"Ready-mix concrete C25/30","quantity":0.15,"unit":"m3","unit_rate":145,"manhours_per_unit":0},
    {"type":"labour","description":"Groundworker - place & compact","quantity":0.04,"unit":"day","unit_rate":260,"manhours_per_unit":0.33},
    {"type":"plant","description":"Poker vibrator","quantity":0.04,"unit":"day","unit_rate":45,"manhours_per_unit":0},
    {"type":"consumable","description":"Polythene membrane","quantity":1.1,"unit":"m2","unit_rate":0.85,"manhours_per_unit":0}
  ]'::jsonb,
  0.33, TRUE
),
(
  'Install 110mm uPVC drain pipe', 'm', 18.00, 'Drainage',
  '[
    {"type":"material","description":"110mm uPVC pipe","quantity":1.05,"unit":"m","unit_rate":8.50,"manhours_per_unit":0},
    {"type":"material","description":"Pipe fittings (allow)","quantity":0.1,"unit":"item","unit_rate":15,"manhours_per_unit":0},
    {"type":"labour","description":"Groundworker - lay & joint","quantity":0.025,"unit":"day","unit_rate":260,"manhours_per_unit":0.2},
    {"type":"material","description":"Pea gravel bedding","quantity":0.15,"unit":"m3","unit_rate":42,"manhours_per_unit":0}
  ]'::jsonb,
  0.2, TRUE
)
ON CONFLICT DO NOTHING;
