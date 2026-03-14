-- 1. Insert "Brick Wall" Assembly
INSERT INTO assemblies (id, tenant_id, code, name, category, required_inputs, is_system_default) VALUES 
  ('00000000-0000-0000-0000-000000000002', NULL, 'ASM-WALL-100', 'Single Skin Brick Wall', 'Walls',
   '["length_m","height_m"]'::JSONB, TRUE
  ) ON CONFLICT DO NOTHING;

-- 2. Insert Brick Resources
INSERT INTO cost_library_items (id, tenant_id, code, description, unit, base_rate, resource_type, is_system_default) VALUES
  ('00000000-0000-0000-0000-000000000040', NULL, 'MAT-BRICK', 'Facing Bricks', 'm2', 60.00, 'Material', TRUE),
  ('00000000-0000-0000-0000-000000000041', NULL, 'LAB-BRICK', 'Bricklayer', 'hour', 30.00, 'Labour', TRUE),
  ('00000000-0000-0000-0000-000000000042', NULL, 'MAT-MORTAR', 'Mortar', 'm2', 10.00, 'Material', TRUE)
ON CONFLICT DO NOTHING;

-- 3. Link Recipe (Area Based)
INSERT INTO assembly_items (assembly_id, cost_library_item_id, quantity_formula, sort_order) VALUES
  -- Bricks: Length * Height
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000040', 'length_m * height_m', 1),
  -- Mortar: Length * Height
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000042', 'length_m * height_m', 2),
  -- Labour: 1.5 hours per m2
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000041', '(length_m * height_m) * 1.5', 3);
