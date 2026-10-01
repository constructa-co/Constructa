-- Historical compatibility migration.
--
-- The proposed flat-library-to-MoM consolidation depended on the abandoned
-- category-based `cost_library` shape from `20260226260000_lean_library.sql`.
-- It also renamed both established library tables even though later migrations,
-- current Phase 1 estimating code and the recovered live schema continue to use
-- `cost_library` and `cost_library_items` under their original names.
--
-- Do not manufacture catalogue columns, duplicate rows into every organization,
-- or rename the canonical tables during clean reconstruction. MoM tables remain
-- available for the later feature set, while the Phase 1 estimator continues to
-- use `cost_library_items` and the owner-scoped resource pages retain
-- `cost_library`.
DO $$
BEGIN
    RAISE NOTICE 'Skipping abandoned cost-library consolidation';
END
$$;
