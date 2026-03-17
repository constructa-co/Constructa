-- Sprint 1: Add is_featured flag to mom_items for progressive disclosure UI
ALTER TABLE public.mom_items ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE public.mom_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.mom_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Index for fast featured queries
CREATE INDEX IF NOT EXISTS idx_mom_items_featured ON public.mom_items(category_id, is_featured);
