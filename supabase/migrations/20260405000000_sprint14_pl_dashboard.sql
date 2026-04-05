-- ── Sprint 14: Job P&L Dashboard ─────────────────────────────────────────────
-- Creates variations + invoices tables (previously missing from production DB)
-- Enhances project_expenses with cost_type + trade_section for P&L tracking

-- ── Variations table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE variations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'variations' AND policyname = 'Users can view variations of their projects') THEN
    CREATE POLICY "Users can view variations of their projects" ON variations FOR SELECT
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'variations' AND policyname = 'Users can insert variations to their projects') THEN
    CREATE POLICY "Users can insert variations to their projects" ON variations FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'variations' AND policyname = 'Users can update variations of their projects') THEN
    CREATE POLICY "Users can update variations of their projects" ON variations FOR UPDATE
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'variations' AND policyname = 'Users can delete variations of their projects') THEN
    CREATE POLICY "Users can delete variations of their projects" ON variations FOR DELETE
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

-- ── Invoices table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Interim', 'Final')),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Users can view invoices of their projects') THEN
    CREATE POLICY "Users can view invoices of their projects" ON invoices FOR SELECT
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Users can insert invoices to their projects') THEN
    CREATE POLICY "Users can insert invoices to their projects" ON invoices FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Users can update invoices of their projects') THEN
    CREATE POLICY "Users can update invoices of their projects" ON invoices FOR UPDATE
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Users can delete invoices of their projects') THEN
    CREATE POLICY "Users can delete invoices of their projects" ON invoices FOR DELETE
      USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));
  END IF;
END $$;

-- ── Enhance project_expenses for P&L ─────────────────────────────────────────
ALTER TABLE project_expenses
  ADD COLUMN IF NOT EXISTS cost_type TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS trade_section TEXT DEFAULT 'General';

ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_cost_type_check;
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_cost_type_check
  CHECK (cost_type IN ('labour', 'materials', 'plant', 'subcontract', 'overhead', 'prelims', 'other'));
