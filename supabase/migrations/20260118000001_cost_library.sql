CREATE TABLE IF NOT EXISTS cost_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
    resource_type TEXT NOT NULL -- 'Labour', 'Material', 'Plant'
);

-- Enable RLS
ALTER TABLE cost_library ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own library" ON cost_library
    FOR ALL USING (auth.uid() = user_id);
