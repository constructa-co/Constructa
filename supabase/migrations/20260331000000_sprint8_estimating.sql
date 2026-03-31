-- Sprint 8: Full BoQ Estimating Tool
-- 1. Drop the overly restrictive constraint on estimate_lines
ALTER TABLE estimate_lines DROP CONSTRAINT IF EXISTS estimate_line_ref_check;

-- 2. Add trade_section for grouping lines within an estimate
ALTER TABLE estimate_lines ADD COLUMN IF NOT EXISTS trade_section TEXT DEFAULT 'General';

-- 3. Add risk_pct to estimates (alongside existing overhead_pct and profit_pct)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS risk_pct NUMERIC(5,2) DEFAULT 0;

-- 4. Add is_active flag — only one estimate per project feeds the proposal
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

-- 5. Add mom_item_code for Method of Measurement reference (optional)
ALTER TABLE estimate_lines ADD COLUMN IF NOT EXISTS mom_item_code TEXT;

-- 6. Add notes column to estimate_lines
ALTER TABLE estimate_lines ADD COLUMN IF NOT EXISTS notes TEXT;

-- 7. Create labour_rates table — default rates per trade, overridable per org
CREATE TABLE IF NOT EXISTS labour_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  trade TEXT NOT NULL,
  role TEXT NOT NULL,
  day_rate NUMERIC(10,2) NOT NULL,
  hourly_rate NUMERIC(10,2) GENERATED ALWAYS AS (day_rate / 8) STORED,
  region TEXT DEFAULT 'national',
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE labour_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_labour_rates ON labour_rates FOR SELECT
  USING (is_system_default = TRUE OR organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY manage_labour_rates ON labour_rates FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- 8. Seed cost library with 60+ items across UK construction trades
-- Clear existing minimal seed and replace with full library
-- First remove all references to system default cost library items
DELETE FROM assembly_options WHERE cost_library_item_id IN (
  SELECT id FROM cost_library_items WHERE is_system_default = TRUE
);
DELETE FROM assembly_items WHERE cost_library_item_id IN (
  SELECT id FROM cost_library_items WHERE is_system_default = TRUE
);
-- Nullify estimate_lines references (keep the lines, just unlink from old library items)
UPDATE estimate_lines SET cost_library_item_id = NULL WHERE cost_library_item_id IN (
  SELECT id FROM cost_library_items WHERE is_system_default = TRUE
);
DELETE FROM cost_library_items WHERE is_system_default = TRUE;

INSERT INTO cost_library_items (id, user_id, tenant_id, code, description, unit, base_rate, category, is_system_default) VALUES
  -- GROUNDWORKS & EXCAVATION
  (gen_random_uuid(), NULL, NULL, 'GW-001', 'Excavate topsoil by machine', 'm2', 3.50, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-002', 'Bulk excavation by machine', 'm3', 18.00, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-003', 'Excavate trench by machine', 'm3', 22.00, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-004', 'Excavate trench by hand', 'm3', 65.00, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-005', 'Disposal of excavated material (skip)', 'm3', 45.00, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-006', 'Disposal off-site (licensed tip)', 'm3', 85.00, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-007', 'Hardcore fill & compact', 'm3', 38.00, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-008', 'Sand blinding 50mm', 'm2', 4.50, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-009', 'Geotextile membrane', 'm2', 2.80, 'Groundworks', TRUE),
  (gen_random_uuid(), NULL, NULL, 'GW-010', 'Site clearance & grub up vegetation', 'm2', 5.50, 'Groundworks', TRUE),

  -- CONCRETE
  (gen_random_uuid(), NULL, NULL, 'CON-001', 'Mass concrete foundations C25/30', 'm3', 145.00, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-002', 'Reinforced concrete C30/37', 'm3', 175.00, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-003', 'Concrete ground slab 150mm C25/30', 'm2', 38.00, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-004', 'Concrete ground slab 200mm C30/37', 'm2', 52.00, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-005', 'Steel reinforcement bar (rebar) 16mm', 'tonne', 980.00, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-006', 'Steel mesh A393', 'm2', 8.50, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-007', 'Formwork to edge of slab', 'm', 12.00, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-008', 'Concrete plinth (bespoke)', 'nr', 850.00, 'Concrete', TRUE),
  (gen_random_uuid(), NULL, NULL, 'CON-009', 'Power float finish to slab', 'm2', 4.50, 'Concrete', TRUE),

  -- DRAINAGE
  (gen_random_uuid(), NULL, NULL, 'DR-001', '110mm uPVC drain pipe', 'm', 12.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-002', '160mm uPVC drain pipe', 'm', 18.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-003', '225mm concrete pipe', 'm', 28.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-004', 'Standard manhole 600x600 (1.0m deep)', 'nr', 650.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-005', 'Deep manhole 1050mm dia (2.0m deep)', 'nr', 1850.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-006', 'Channel drain 100mm c/w grate', 'm', 45.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-007', 'Gully pot with trapped outlet', 'nr', 185.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-008', 'Soakaway crate 400L', 'nr', 95.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-009', 'CCTV drain survey', 'item', 350.00, 'Drainage', TRUE),
  (gen_random_uuid(), NULL, NULL, 'DR-010', 'Pipe bedding (pea gravel)', 'm3', 42.00, 'Drainage', TRUE),

  -- UTILITIES & DUCTING
  (gen_random_uuid(), NULL, NULL, 'UT-001', '50mm HDPE duct', 'm', 6.50, 'Utilities', TRUE),
  (gen_random_uuid(), NULL, NULL, 'UT-002', '100mm HDPE duct', 'm', 12.00, 'Utilities', TRUE),
  (gen_random_uuid(), NULL, NULL, 'UT-003', '150mm HDPE duct', 'm', 18.50, 'Utilities', TRUE),
  (gen_random_uuid(), NULL, NULL, 'UT-004', 'Cable draw pit 600x600', 'nr', 285.00, 'Utilities', TRUE),
  (gen_random_uuid(), NULL, NULL, 'UT-005', 'Duct marker tape', 'm', 0.85, 'Utilities', TRUE),
  (gen_random_uuid(), NULL, NULL, 'UT-006', 'Utility trench (supply & install)', 'm', 65.00, 'Utilities', TRUE),
  (gen_random_uuid(), NULL, NULL, 'UT-007', 'Service connection (allow)', 'item', 1200.00, 'Utilities', TRUE),

  -- SURFACING & PAVING
  (gen_random_uuid(), NULL, NULL, 'SU-001', 'Tarmac / Asphalt 40mm binder course', 'm2', 16.00, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-002', 'Tarmac / Asphalt 30mm wearing course', 'm2', 14.00, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-003', 'Block paving (standard)', 'm2', 55.00, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-004', 'Block paving (premium)', 'm2', 85.00, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-005', 'Resin bound surface 18mm', 'm2', 75.00, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-006', 'Concrete kerb supply & fix', 'm', 22.00, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-007', 'Granite sett kerb supply & fix', 'm', 48.00, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-008', 'Line marking (white)', 'm', 4.50, 'Surfacing', TRUE),
  (gen_random_uuid(), NULL, NULL, 'SU-009', 'Tactile paving', 'm2', 65.00, 'Surfacing', TRUE),

  -- MASONRY & BRICKWORK
  (gen_random_uuid(), NULL, NULL, 'BK-001', 'Brickwork half brick thick', 'm2', 85.00, 'Masonry', TRUE),
  (gen_random_uuid(), NULL, NULL, 'BK-002', 'Brickwork one brick thick', 'm2', 145.00, 'Masonry', TRUE),
  (gen_random_uuid(), NULL, NULL, 'BK-003', 'Blockwork 100mm coursed', 'm2', 48.00, 'Masonry', TRUE),
  (gen_random_uuid(), NULL, NULL, 'BK-004', 'Cavity wall (brick/block with insulation)', 'm2', 165.00, 'Masonry', TRUE),
  (gen_random_uuid(), NULL, NULL, 'BK-005', 'DPC 100mm Hyload', 'm', 3.20, 'Masonry', TRUE),

  -- LABOUR (day rates as supply-only items)
  (gen_random_uuid(), NULL, NULL, 'LAB-001', 'General operative (labourer) day rate', 'day', 200.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-002', 'Skilled tradesperson day rate', 'day', 280.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-003', 'Groundworker day rate', 'day', 260.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-004', 'Electrician day rate', 'day', 320.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-005', 'Plumber day rate', 'day', 300.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-006', 'Bricklayer day rate', 'day', 280.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-007', 'Carpenter / joiner day rate', 'day', 280.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-008', 'Site manager day rate', 'day', 380.00, 'Labour', TRUE),
  (gen_random_uuid(), NULL, NULL, 'LAB-009', 'Plant operator day rate', 'day', 290.00, 'Labour', TRUE),

  -- PLANT & EQUIPMENT
  (gen_random_uuid(), NULL, NULL, 'PL-001', '5t excavator hire (day)', 'day', 380.00, 'Plant', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PL-002', '13t excavator hire (day)', 'day', 550.00, 'Plant', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PL-003', 'Dumper 9t hire (day)', 'day', 185.00, 'Plant', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PL-004', 'Vibrating roller hire (day)', 'day', 220.00, 'Plant', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PL-005', 'Telehandler hire (day)', 'day', 420.00, 'Plant', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PL-006', 'Skip 8yd3 supply & collect', 'nr', 285.00, 'Plant', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PL-007', 'Traffic management (simple, day)', 'day', 650.00, 'Plant', TRUE),

  -- PRELIMINARIES
  (gen_random_uuid(), NULL, NULL, 'PRE-001', 'Site setup & welfare', 'item', 1500.00, 'Preliminaries', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PRE-002', 'Temporary hoarding / fencing', 'm', 18.00, 'Preliminaries', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PRE-003', 'Health & Safety file / plan', 'item', 500.00, 'Preliminaries', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PRE-004', 'Project manager weekly', 'week', 850.00, 'Preliminaries', TRUE),
  (gen_random_uuid(), NULL, NULL, 'PRE-005', 'Temporary water supply', 'item', 350.00, 'Preliminaries', TRUE)
ON CONFLICT DO NOTHING;

-- 9. Seed national labour rates
INSERT INTO labour_rates (trade, role, day_rate, region, is_system_default) VALUES
  ('Groundworks', 'Groundworker', 260.00, 'national', TRUE),
  ('Groundworks', 'Groundworker (London)', 320.00, 'london', TRUE),
  ('Groundworks', 'Plant Operator', 290.00, 'national', TRUE),
  ('Electrical', 'Electrician', 320.00, 'national', TRUE),
  ('Electrical', 'Electrician (London)', 390.00, 'london', TRUE),
  ('Plumbing', 'Plumber', 300.00, 'national', TRUE),
  ('Masonry', 'Bricklayer', 280.00, 'national', TRUE),
  ('Carpentry', 'Carpenter / Joiner', 280.00, 'national', TRUE),
  ('General', 'Labourer', 200.00, 'national', TRUE),
  ('General', 'Labourer (London)', 250.00, 'london', TRUE),
  ('Management', 'Site Manager', 380.00, 'national', TRUE),
  ('Management', 'Project Manager', 450.00, 'national', TRUE),
  ('Surfacing', 'Asphalt Operative', 270.00, 'national', TRUE)
ON CONFLICT DO NOTHING;
