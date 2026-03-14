-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Interim', 'Final')),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Users can view invoices of their projects" 
ON invoices FOR SELECT 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can insert invoices to their projects" 
ON invoices FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update invoices of their projects" 
ON invoices FOR UPDATE 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete invoices of their projects" 
ON invoices FOR DELETE 
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = invoices.project_id AND projects.user_id = auth.uid()));
