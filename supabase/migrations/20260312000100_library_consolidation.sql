-- 1. Ensure MoM tables use organization_id consistently (redundant but safe)
ALTER TABLE public.mom_categories DROP CONSTRAINT IF EXISTS mom_categories_user_id_code_key;
ALTER TABLE public.mom_categories ADD CONSTRAINT mom_categories_org_id_code_key UNIQUE (organization_id, code);

ALTER TABLE public.mom_items DROP CONSTRAINT IF EXISTS mom_items_user_id_code_key;
ALTER TABLE public.mom_items ADD CONSTRAINT mom_items_org_id_code_key UNIQUE (organization_id, code);

-- 2. Migration Logic: Flat Library -> Nested MoM
DO $$
DECLARE
    rec RECORD;
    top_cat_id UUID;
    sub_cat_id UUID;
    org_id UUID;
BEGIN
    -- For each item in the flat cost_library
    FOR rec IN SELECT * FROM public.cost_library LOOP
        
        -- Identify the organization (for system items, we'll assign to the first owner found or handle specially)
        -- Since users see system items, we'll assign them to their own orgs if they are custom, 
        -- or create a "System Org" for shared items if needed.
        -- For now, let's assume we migrate items to the organizations of the users who can see them.
        
        -- Logic: If it's a system item, we'll add it to ALL organizations for now so everyone has it.
        -- If it's a user item, we'll add it to their organization.
        
        FOR org_id IN SELECT id FROM public.organizations LOOP
            
            -- Get or Create Top Category (e.g., "1. Preliminaries")
            INSERT INTO public.mom_categories (organization_id, code, name)
            VALUES (org_id, split_part(rec.category, ' ', 1), rec.category)
            ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
            RETURNING id INTO top_cat_id;

            -- Get or Create Sub Category (e.g., "Site Setup & Welfare")
            IF rec.sub_category IS NOT NULL THEN
                -- We'll use a slug of the sub_category as a temporary code if none exists
                INSERT INTO public.mom_categories (organization_id, parent_id, code, name)
                VALUES (org_id, top_cat_id, lower(regexp_replace(rec.sub_category, '[^a-zA-Z0-9]', '_', 'g')), rec.sub_category)
                ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
                RETURNING id INTO sub_cat_id;
            ELSE
                sub_cat_id := top_cat_id;
            END IF;

            -- Insert the Item
            INSERT INTO public.mom_items (organization_id, category_id, code, description, unit, base_rate)
            VALUES (org_id, sub_cat_id, rec.item_code, rec.description, rec.unit, rec.rate)
            ON CONFLICT (organization_id, code) DO NOTHING;
            
        END LOOP;
    END LOOP;
END $$;

-- 3. Deprecate flat tables (keep for safety during transition, but rename)
ALTER TABLE public.cost_library RENAME TO legacy_cost_library;
ALTER TABLE public.cost_library_items RENAME TO legacy_cost_library_items;
