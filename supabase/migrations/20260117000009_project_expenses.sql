CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assembly_id UUID REFERENCES assemblies(id), -- Optional: Link to specific task
  description TEXT NOT NULL,
  supplier TEXT,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own expenses" ON project_expenses FOR ALL USING (auth.uid() = (SELECT user_id FROM projects WHERE id = project_expenses.project_id));
