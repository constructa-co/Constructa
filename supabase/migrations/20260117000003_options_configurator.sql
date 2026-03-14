-- 1. Create Options Table
CREATE TABLE IF NOT EXISTS assembly_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assemblies (id) ON DELETE CASCADE,
  cost_library_item_id UUID NOT NULL REFERENCES cost_library_items (id),
  label TEXT, -- e.g. "Add Reinforcement Mesh"
  quantity_formula TEXT,
  default_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE assembly_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Options" ON assembly_options FOR SELECT USING (true);

-- 2. Insert Resources for the Options
INSERT INTO cost_library_items (id, tenant_id, code, description, unit, base_rate, resource_type, is_system_default) VALUES
  ('00000000-0000-0000-0000-000000000050', NULL, 'MAT-MESH', 'A193 Mesh Reinforcement', 'm2', 8.50, 'Material', TRUE),
  ('00000000-0000-0000-0000-000000000051', NULL, 'MAT-FROST', 'Frost Protection Blankets', 'm2', 4.00, 'Material', TRUE)
ON CONFLICT DO NOTHING;

-- 3. Link Options to "Strip Foundation" (Using the ID from Slice 1.5)
INSERT INTO assembly_options (assembly_id, cost_library_item_id, label, quantity_formula, default_selected) VALUES
  -- Mesh: Area of trench bottom (Length * Width) * 1.1 for overlap
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000050', 'Include Reinforcement (A193)', '(length_m * trench_width_m) * 1.1', FALSE),
  -- Frost: Top surface area (Length * Width)
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000051', 'Add Frost Protection', 'length_m * trench_width_m', FALSE);
