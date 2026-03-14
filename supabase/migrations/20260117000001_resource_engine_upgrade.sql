-- 1. Add resource_type to cost items
ALTER TABLE cost_library_items 
ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'Material'; 
-- (Values: 'Material', 'Labour', 'Plant', 'Subcontract', 'Fee')

-- 2. Add markup columns to Estimates (if not already present)
-- (We already added overhead_pct, profit_pct in Slice 1. Adding risk_pct now)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS risk_pct NUMERIC(5,2) DEFAULT 0;

-- 3. Add 'hours' tracking to estimate lines
ALTER TABLE estimate_lines
ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10,2) DEFAULT 0;

-- 4. CLEANUP: Wipe old seed data so we can insert the new "Complex" recipes
-- Must clear existing estimates first to avoid Foreign Key violations on assemblies
DELETE FROM estimate_lines; 
DELETE FROM estimates;

DELETE FROM assembly_items;
DELETE FROM assemblies;
DELETE FROM cost_library_items;

-- 5. SEED NEW "FIRST PRINCIPLES" DATA
-- Resources
INSERT INTO cost_library_items (id, tenant_id, code, description, unit, base_rate, resource_type, is_system_default) VALUES
  -- Labour
  ('00000000-0000-0000-0000-000000000010', NULL, 'LAB-GEN', 'General Labourer (Joe)', 'hour', 15.00, 'Labour', TRUE),
  ('00000000-0000-0000-0000-000000000011', NULL, 'LAB-SKILL', 'Groundworker (Dave)', 'hour', 25.00, 'Labour', TRUE),
  -- Plant
  ('00000000-0000-0000-0000-000000000020', NULL, 'PLT-EXC', '1.5T Excavator', 'day', 80.00, 'Plant', TRUE),
  -- Material
  ('00000000-0000-0000-0000-000000000030', NULL, 'MAT-CONC', 'Concrete Gen 1', 'm3', 110.00, 'Material', TRUE),
  ('00000000-0000-0000-0000-000000000031', NULL, 'MAT-DISP', 'Muck Away', 'load', 250.00, 'Subcontract', TRUE);

-- Assembly: "Smart Strip Foundation"
INSERT INTO assemblies (id, tenant_id, code, name, category, required_inputs, is_system_default) VALUES 
  ('00000000-0000-0000-0000-000000000001', NULL, 'ASM-STRIP-ADV', 'Advanced Strip Foundation', 'Foundations',
   '["length_m","trench_width_m","trench_depth_m","concrete_thickness_m"]'::JSONB, TRUE
  );

-- Assembly Items (The Recipe)
INSERT INTO assembly_items (assembly_id, cost_library_item_id, quantity_formula, sort_order) VALUES
  -- 1. Excavator (Plant): Formula assumes 50m3 per day output. 
  -- (Volume / 50) = Days needed.
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', '(length_m * trench_width_m * trench_depth_m) / 50', 1),
  
  -- 2. Driver (Labour - Dave): Matches Excavator Days * 8 hours
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '((length_m * trench_width_m * trench_depth_m) / 50) * 8', 2),

  -- 3. Concrete (Material): Volume
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'length_m * trench_width_m * concrete_thickness_m', 3),

  -- 4. Labour for Pour (Joe): 1 hour per m3 of concrete
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', '(length_m * trench_width_m * concrete_thickness_m) * 1', 4),

  -- 5. Disposal (Subcon): Volume * 1.5 (bulking) / 8 (load size)
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', '(length_m * trench_width_m * trench_depth_m * 1.5) / 8', 5);
