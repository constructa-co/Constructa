-- 1. MoM Categories Table (Supporting infinite nesting)
CREATE TABLE IF NOT EXISTS mom_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES mom_categories(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, code) -- Each code should be unique per user at its level
);

-- 2. MoM Items Table
CREATE TABLE IF NOT EXISTS mom_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES mom_categories(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    base_rate NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, code)
);

-- 3. RLS Policies
ALTER TABLE mom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE mom_items ENABLE ROW LEVEL SECURITY;

-- Categories Policies
CREATE POLICY "Users can manage their own MoM categories" 
ON mom_categories FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Items Policies
CREATE POLICY "Users can manage their own MoM items" 
ON mom_items FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
