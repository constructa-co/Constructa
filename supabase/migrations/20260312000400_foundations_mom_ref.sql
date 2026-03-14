-- 1. Update assembly_items to point to MoM
ALTER TABLE public.assembly_items DROP CONSTRAINT IF EXISTS assembly_items_cost_library_item_id_fkey;
ALTER TABLE public.assembly_items ADD COLUMN IF NOT EXISTS mom_item_id UUID REFERENCES public.mom_items(id);

-- 2. Update assembly_options to point to MoM
ALTER TABLE public.assembly_options DROP CONSTRAINT IF EXISTS assembly_options_cost_library_item_id_fkey;
ALTER TABLE public.assembly_options ADD COLUMN IF NOT EXISTS mom_item_id UUID REFERENCES public.mom_items(id);

-- 3. Migrate data for existing assemblies (manual mapping or heuristic)
-- For now, we'll try to match by code or description if possible, 
-- but since this is a clean breakout, we'll let existing ones stay null and new ones point to MoM.
-- In a real production app, we'd do a fuzzy match migration here.

-- 4. Update estimate_lines to point to MoM
ALTER TABLE public.estimate_lines DROP CONSTRAINT IF EXISTS estimate_lines_cost_library_item_id_fkey;
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS mom_item_id UUID REFERENCES public.mom_items(id);
