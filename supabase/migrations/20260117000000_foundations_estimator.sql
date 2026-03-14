-- 1. Create profiles table (linked to Supabase auth.users via id)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  name TEXT,
  address TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_tenant_proj FOREIGN KEY (tenant_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT projects_tenant_check CHECK (tenant_id = user_id)
);

-- 3. Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version_name TEXT,
  total_cost NUMERIC(12,2),
  overhead_pct NUMERIC(5,2),
  profit_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create cost_library_items table (Must be before estimate_lines and assembly_items due to FK)
CREATE TABLE IF NOT EXISTS cost_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES profiles (id) ON DELETE SET NULL,
  tenant_id UUID NULL, -- Changed to NULLABLE to support system defaults where tenant_id is NULL
  code TEXT,
  description TEXT,
  unit TEXT,
  base_rate NUMERIC(12,2),
  category TEXT,
  is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_tenant_item FOREIGN KEY (tenant_id) REFERENCES profiles (id) ON DELETE CASCADE
);

-- 5. Create assemblies table
CREATE TABLE IF NOT EXISTS assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES profiles (id) ON DELETE SET NULL,
  tenant_id UUID NULL, -- Changed to NULLABLE to support system defaults
  code TEXT,
  name TEXT,
  category TEXT,
  required_inputs JSONB,
  is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_tenant_asm FOREIGN KEY (tenant_id) REFERENCES profiles (id) ON DELETE CASCADE
);

-- 4. Create estimate_lines table
CREATE TABLE IF NOT EXISTS estimate_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates (id) ON DELETE CASCADE,
  cost_library_item_id UUID NULL REFERENCES cost_library_items (id),
  assembly_id UUID NULL REFERENCES assemblies (id),
  description TEXT,
  unit TEXT,
  quantity NUMERIC(12,4),
  unit_rate NUMERIC(12,2),
  line_total NUMERIC(12,2),
  sort_order INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT estimate_line_ref_check CHECK (
    (cost_library_item_id IS NOT NULL OR assembly_id IS NOT NULL)
  )
);

-- 6. Create assembly_items table
CREATE TABLE IF NOT EXISTS assembly_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES assemblies (id) ON DELETE CASCADE,
  cost_library_item_id UUID NOT NULL REFERENCES cost_library_items (id),
  quantity_formula TEXT,
  formula_validated_at TIMESTAMPTZ,
  sort_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estimates_project ON estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate ON estimate_lines(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_cost_item ON estimate_lines(cost_library_item_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_assembly ON estimate_lines(assembly_id);
CREATE INDEX IF NOT EXISTS idx_assemblies_user ON assemblies(user_id);
CREATE INDEX IF NOT EXISTS idx_assemblies_tenant ON assemblies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assemblies_code ON assemblies(code);
CREATE INDEX IF NOT EXISTS idx_assembly_items_asm ON assembly_items(assembly_id);
CREATE INDEX IF NOT EXISTS idx_assembly_items_item ON assembly_items(cost_library_item_id);
CREATE INDEX IF NOT EXISTS idx_cost_items_user ON cost_library_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_items_tenant ON cost_library_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_items_code ON cost_library_items(code);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_library_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles
CREATE POLICY select_self_profile ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY update_self_profile ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Projects
CREATE POLICY select_own_projects ON projects FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY insert_own_projects ON projects FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = auth.uid());
CREATE POLICY update_own_projects ON projects FOR UPDATE USING (tenant_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND tenant_id = auth.uid());
CREATE POLICY delete_own_projects ON projects FOR DELETE USING (tenant_id = auth.uid());

-- Estimates
CREATE POLICY select_own_estimates ON estimates FOR SELECT USING (project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid()));
CREATE POLICY insert_own_estimates ON estimates FOR INSERT WITH CHECK (NEW.project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid()));
CREATE POLICY update_own_estimates ON estimates FOR UPDATE USING (project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid())) WITH CHECK (NEW.project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid()));
CREATE POLICY delete_own_estimates ON estimates FOR DELETE USING (project_id IN (SELECT p.id FROM projects p WHERE p.user_id = auth.uid()));

-- Estimate Lines
CREATE POLICY select_own_estimate_lines ON estimate_lines FOR SELECT USING (EXISTS (SELECT 1 FROM estimates e JOIN projects pr ON e.project_id = pr.id WHERE e.id = estimate_lines.estimate_id AND pr.user_id = auth.uid()));
CREATE POLICY insert_own_estimate_lines ON estimate_lines FOR INSERT WITH CHECK (NEW.estimate_id IN (SELECT e.id FROM estimates e JOIN projects pr ON e.project_id = pr.id WHERE pr.user_id = auth.uid()));
CREATE POLICY update_own_estimate_lines ON estimate_lines FOR UPDATE USING (EXISTS (SELECT 1 FROM estimates e JOIN projects pr ON e.project_id = pr.id WHERE e.id = estimate_lines.estimate_id AND pr.user_id = auth.uid())) WITH CHECK (NEW.estimate_id IN (SELECT e.id FROM estimates e JOIN projects pr ON e.project_id = pr.id WHERE pr.user_id = auth.uid()));
CREATE POLICY delete_own_estimate_lines ON estimate_lines FOR DELETE USING (EXISTS (SELECT 1 FROM estimates e JOIN projects pr ON e.project_id = pr.id WHERE e.id = estimate_lines.estimate_id AND pr.user_id = auth.uid()));

-- Assemblies
CREATE POLICY select_user_and_system_assemblies ON assemblies FOR SELECT USING (is_system_default OR tenant_id = auth.uid());
CREATE POLICY insert_user_assemblies ON assemblies FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = auth.uid() AND is_system_default = FALSE);
CREATE POLICY update_user_assemblies ON assemblies FOR UPDATE USING (tenant_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND tenant_id = auth.uid() AND is_system_default = FALSE);
CREATE POLICY delete_user_assemblies ON assemblies FOR DELETE USING (tenant_id = auth.uid() AND is_system_default = FALSE);

-- Cost Library Items
CREATE POLICY select_user_and_system_cost_items ON cost_library_items FOR SELECT USING (is_system_default OR tenant_id = auth.uid());
CREATE POLICY insert_user_cost_items ON cost_library_items FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = auth.uid() AND is_system_default = FALSE);
CREATE POLICY update_user_cost_items ON cost_library_items FOR UPDATE USING (tenant_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND tenant_id = auth.uid() AND is_system_default = FALSE);
CREATE POLICY delete_user_cost_items ON cost_library_items FOR DELETE USING (tenant_id = auth.uid() AND is_system_default = FALSE);

-- Assembly Items
CREATE POLICY select_user_and_system_assembly_items ON assembly_items FOR SELECT USING (EXISTS (SELECT 1 FROM assemblies asm JOIN cost_library_items cli ON asm.id = assembly_items.assembly_id AND cli.id = assembly_items.cost_library_item_id WHERE (asm.tenant_id = auth.uid() OR asm.is_system_default) AND (cli.tenant_id = auth.uid() OR cli.is_system_default)));
-- Simplified insert/update/delete policies for assembly items to avoid complex subqueries in check (assuming app logic enforces ownership)
CREATE POLICY insert_user_assembly_items ON assembly_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM assemblies asm WHERE asm.id = NEW.assembly_id AND asm.tenant_id = auth.uid()));
CREATE POLICY update_user_assembly_items ON assembly_items FOR UPDATE USING (EXISTS (SELECT 1 FROM assemblies asm WHERE asm.id = assembly_items.assembly_id AND asm.tenant_id = auth.uid()));
CREATE POLICY delete_user_assembly_items ON assembly_items FOR DELETE USING (EXISTS (SELECT 1 FROM assemblies asm WHERE asm.id = assembly_items.assembly_id AND asm.tenant_id = auth.uid()));

-- Canary Trigger
CREATE OR REPLACE FUNCTION warn_if_many_lines() RETURNS TRIGGER AS $$
DECLARE 
    line_count INT;
BEGIN
  SELECT COUNT(*) INTO line_count FROM estimate_lines WHERE estimate_id = NEW.estimate_id;
  IF line_count > 500 THEN
    RAISE WARNING 'Estimate % now has % line items, which exceeds the recommended limit of 500.', NEW.estimate_id, line_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimate_line_count_warning ON estimate_lines;
CREATE TRIGGER estimate_line_count_warning AFTER INSERT OR UPDATE ON estimate_lines FOR EACH ROW EXECUTE FUNCTION warn_if_many_lines();

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- SEED DATA

-- Cost Library Items
INSERT INTO cost_library_items (id, user_id, tenant_id, code, description, unit, base_rate, category, is_system_default) VALUES
  ('00000000-0000-0000-0000-000000000011', NULL, NULL, 'EXC-001', 'Excavate Trench (Machine)', 'm3', 25.00, 'Excavation', TRUE),
  ('00000000-0000-0000-0000-000000000012', NULL, NULL, 'CON-001', 'Pour Concrete Gen 1', 'm3', 140.00, 'Concrete', TRUE),
  ('00000000-0000-0000-0000-000000000013', NULL, NULL, 'DIS-001', 'Disposal of Spoil', 'm3', 45.00, 'Disposal', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Assemblies
INSERT INTO assemblies (id, user_id, tenant_id, code, name, category, required_inputs, is_system_default) VALUES 
  ('00000000-0000-0000-0000-000000000001', NULL, NULL, 'ASM-STRIP-STD', 'Standard Strip Foundation', 'Foundations',
   '["length_m","trench_width_m","trench_depth_m","concrete_thickness_m"]'::JSONB, TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- Assembly Items
INSERT INTO assembly_items (id, assembly_id, cost_library_item_id, quantity_formula, formula_validated_at, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011',
   'length_m * trench_width_m * trench_depth_m', now(), 1),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012',
   'length_m * trench_width_m * concrete_thickness_m', now(), 2),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013',
   'length_m * trench_width_m * trench_depth_m', now(), 3)
ON CONFLICT (id) DO NOTHING;
