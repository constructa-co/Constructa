-- Create variations table
CREATE TABLE IF NOT EXISTS variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE variations ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Assumes projects table ownership logic)
CREATE POLICY "Users can view variations of their projects" 
ON variations FOR SELECT 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can insert variations to their projects" 
ON variations FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update variations of their projects" 
ON variations FOR UPDATE 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete variations of their projects" 
ON variations FOR DELETE 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = variations.project_id AND projects.user_id = auth.uid()));
