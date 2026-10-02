-- Historical compatibility migration.
--
-- `20260118000001_cost_library.sql` already established `cost_library` as an
-- owner-scoped resource-rate table (`user_id`, `name`, `resource_type`, etc.).
-- This migration previously attempted to reuse that table name for an
-- incompatible shared catalogue (`category`, `sub_category`, `item_code`,
-- etc.). `CREATE TABLE IF NOT EXISTS` therefore did nothing, before the index
-- creation failed because those catalogue columns were absent.
--
-- Phase 1 estimating reads the separately established `cost_library_items`
-- table. The live schema also retains both original tables, so replacing or
-- widening access to the owner-scoped `cost_library` would be both incorrect
-- and a security regression. Keep this historical migration as an explicit
-- no-op; later reconciliation migrations must preserve the two canonical
-- tables rather than manufacturing the abandoned flat-catalogue shape.
DO $$
BEGIN
    RAISE NOTICE 'Skipping abandoned flat cost_library catalogue migration';
END
$$;
